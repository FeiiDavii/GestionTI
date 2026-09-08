<?php
require_once __DIR__ . '/../config/env.php';

class AIController {
    private $pdo;

    private static $ALLOWED_TABLES = [
        'usuarios', 'roles', 'areas', 'marcas', 'tipos_activo',
        'configuraciones_hardware', 'funcionarios', 'equipos_de_computo',
        'tickets', 'tickets_chat', 'sla_registros', 'asignaciones',
        'articulos', 'licencias_software', 'bajas', 'mantenimientos',
        'historial_equipos', 'notificaciones', 'acciones',
        'topology_nodes', 'topology_edges',
    ];

    private static $SYSTEM_CONTEXT;

    public function __construct($pdo) {
        $this->pdo = $pdo;
        if (self::$SYSTEM_CONTEXT === null) {
            self::$SYSTEM_CONTEXT = file_get_contents(__DIR__ . '/../config/ai_context.txt');
        }
    }

    public function chat() {
        Auth::requireLogin();
        Permission::requireAny(['ai_usar']);

        $input = json_decode(file_get_contents('php://input'), true) ?: [];
        $message = sanitize_input($input['message'] ?? '', 'text', 2000);
        $history = $input['history'] ?? [];

        if (empty($message)) {
            json_error('El mensaje es requerido');
        }

        // 1. Execute real-time queries
        $realTimeData = $this->getRealTimeData();

        // 2. Try to generate and execute a dynamic SQL if the question seems data-driven
        $dynamicData = $this->tryDynamicQuery($message);

        // 3. Build the full prompt
        $systemPrompt = self::$SYSTEM_CONTEXT;
        if ($realTimeData) {
            $systemPrompt .= "\n\n## Datos en tiempo real (consulta automática)\n" . $realTimeData;
        }
        if ($dynamicData) {
            $systemPrompt .= "\n\n## Datos consultados específicamente para esta pregunta\n" . $dynamicData;
            $systemPrompt .= "\n\nIMPORTANTE: Los datos de arriba fueron consultados para responder la pregunta del usuario. Interpretalos y presentalos en lenguaje natural. NO devuelvas la consulta SQL ni el formato crudo de los datos.";
        }

        // 4. Call LLM (Gemini primary, Groq fallback)
        $response = $this->callGemini($systemPrompt, $message, $history);
        if ($response === null) {
            $response = $this->callGroq($systemPrompt, $message, $history);
        }
        if ($response === null) {
            json_error('No se pudo conectar con el servicio de IA. Intentá nuevamente.', 503);
        }

        json_success(['reply' => $response, 'provider' => 'ai']);
    }

    // ── Real-time data queries ──────────────────────────────────────────────

    private function getRealTimeData() {
        $data = [];

        try {
            // Tickets by status
            $stmt = $this->pdo->query("SELECT estado, COUNT(*) as total FROM tickets GROUP BY estado");
            $data['tickets_por_estado'] = $stmt->fetchAll(PDO::FETCH_ASSOC);

            // Total equipment by type
            $stmt = $this->pdo->query("
                SELECT t.tipo, COUNT(e.id) as total
                FROM equipos_de_computo e
                JOIN tipos_activo t ON e.id_tipo = t.id
                GROUP BY t.tipo
            ");
            $data['equipos_por_tipo'] = $stmt->fetchAll(PDO::FETCH_ASSOC);

            // Total licenses
            $stmt = $this->pdo->query("SELECT COUNT(*) as total FROM licencias_software");
            $data['total_licencias'] = $stmt->fetch(PDO::FETCH_ASSOC)['total'];

            // Total active users
            $stmt = $this->pdo->query("SELECT COUNT(*) as total FROM usuarios WHERE activo = 1");
            $data['usuarios_activos'] = $stmt->fetch(PDO::FETCH_ASSOC)['total'];

            // Current user's tickets
            $userId = Auth::getUserId();
            $stmt = $this->pdo->prepare("SELECT estado, COUNT(*) as total FROM tickets WHERE usuario_id = ? GROUP BY estado");
            $stmt->execute([$userId]);
            $data['mis_tickets'] = $stmt->fetchAll(PDO::FETCH_ASSOC);

            // Current user's assigned equipment
            $stmt = $this->pdo->prepare("SELECT COUNT(*) as total FROM equipos_de_computo WHERE funcionario_asignado = ?");
            $stmt->execute([$userId]);
            $data['mis_equipos_asignados'] = $stmt->fetch(PDO::FETCH_ASSOC)['total'];

        } catch (Exception $e) {
            error_log("[AIController] getRealTimeData error: " . $e->getMessage());
        }

        if (empty($data)) return null;

        $lines = [];
        foreach ($data as $key => $value) {
            if (is_array($value)) {
                $lines[] = "- $key: " . json_encode($value, JSON_UNESCAPED_UNICODE);
            } else {
                $lines[] = "- $key: $value";
            }
        }
        return implode("\n", $lines);
    }

    // ── Dynamic SQL generation ──────────────────────────────────────────────

    private function tryDynamicQuery($message) {
        $lower = mb_strtolower($message);

        // Only attempt dynamic SQL for data-seeking questions
        $dataKeywords = ['cuántos', 'cuantos', 'cuántas', 'cuantas', 'cuál', 'cual', 'cuáles',
            'cuales', 'dame', 'lista', 'listado', 'mostrar', 'qué hay', 'que hay',
            'total', 'cantidad', 'existen', 'hay', 'tiene', 'tienen', 'cuánto',
            'cuanto', 'dinero', 'costo', 'valor', 'precio', 'área', 'area',
            'técnico', 'tecnico', 'quién', 'quien', 'cuándo', 'cuando'];

        $isDataQuestion = false;
        foreach ($dataKeywords as $kw) {
            if (mb_strpos($lower, $kw) !== false) {
                $isDataQuestion = true;
                break;
            }
        }

        if (!$isDataQuestion) return null;

        // Ask the LLM to generate SQL
        $sqlPrompt = self::$SYSTEM_CONTEXT . "\n\n## Tarea\nEl usuario hizo esta pregunta: \"$message\"\n\nGenerá UNA ÚNICA consulta SELECT SQL válida para MariaDB que responda esta pregunta. Devolvela en este formato exacto:\n{\"sql\": \"SELECT ...\"}\n\nRestricciones:\n- Solo SELECT (nunca INSERT, UPDATE, DELETE, DROP)\n- Solo tablas de la whitelist: " . implode(', ', self::$ALLOWED_TABLES) . "\n- Si no podés generar una consulta, devolvé: {\"sql\": null}";

        $sqlResponse = $this->callGeminiRaw($sqlPrompt, "Respondé solo con el JSON, sin texto adicional.");
        if ($sqlResponse === null) {
            $sqlResponse = $this->callGroqRaw($sqlPrompt, "Respondé solo con el JSON, sin texto adicional.");
        }

        if ($sqlResponse === null) return null;

        // Parse the SQL from response
        $sql = $this->extractSql($sqlResponse);
        if ($sql === null) return null;

        // Validate the SQL
        if (!$this->isValidSql($sql)) return null;

        // Execute
        try {
            $stmt = $this->pdo->query($sql);
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
            $total = count($rows);

            if ($total === 0) {
                return "La consulta no devolvió resultados.";
            }

            $truncated = false;
            if ($total > 20) {
                $rows = array_slice($rows, 0, 20);
                $truncated = true;
            }

            // Build a human-readable summary instead of raw JSON
            $summary = "Resultados de la consulta (" . ($truncated ? "primeros 20 de $total" : "$total") . " registros):\n";
            foreach ($rows as $i => $row) {
                $parts = [];
                foreach ($row as $key => $val) {
                    $parts[] = "$key: $val";
                }
                $summary .= "- " . implode(', ', $parts) . "\n";
            }

            return $summary;
        } catch (Exception $e) {
            error_log("[AIController] Dynamic SQL error: " . $e->getMessage());
            return null;
        }
    }

    private function extractSql($text) {
        $text = trim($text);

        // 1. Try JSON: {"sql": "SELECT ..."}
        // Use a robust approach: find the JSON boundary, then decode
        $jsonStart = strpos($text, '{');
        $jsonEnd = strrpos($text, '}');
        if ($jsonStart !== false && $jsonEnd !== false && $jsonEnd > $jsonStart) {
            $jsonStr = substr($text, $jsonStart, $jsonEnd - $jsonStart + 1);
            $decoded = json_decode($jsonStr, true);
            if ($decoded && isset($decoded['sql']) && $decoded['sql'] !== null) {
                $sql = trim($decoded['sql']);
                if (!empty($sql) && stripos($sql, 'SELECT') === 0) {
                    return $sql;
                }
            }
        }

        // 2. Fallback: find a raw SELECT ... FROM ... statement
        // Use a greedy match that captures everything until end or semicolon
        if (preg_match('/(SELECT\s+[\s\S]+?\s+FROM\s+[\s\S]+?)(?:\s*;?\s*$|\s*\n\s*\n)/is', $text, $matches)) {
            $sql = trim($matches[1], "; \n\r\t");
            if (!empty($sql)) {
                return $sql;
            }
        }

        // 3. Last resort: any SELECT statement
        if (preg_match('/(SELECT\s+.+)/is', $text, $matches)) {
            $sql = trim(preg_replace('/\s+/', ' ', $matches[1]), "; \n\r\t");
            return $sql;
        }

        return null;
    }

    private function isValidSql($sql) {
        $upper = mb_strtoupper(trim($sql));

        // Must start with SELECT
        if (strpos($upper, 'SELECT') !== 0) return false;

        // Must not contain dangerous keywords
        $forbidden = ['INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'CREATE', 'TRUNCATE',
            'GRANT', 'REVOKE', 'EXEC', 'EXECUTE', 'INTO OUTFILE', 'LOAD_FILE',
            'SLEEP', 'BENCHMARK', 'WAITFOR', 'SHUTDOWN'];
        foreach ($forbidden as $word) {
            if (preg_match('/\b' . $word . '\b/i', $sql)) return false;
        }

        // Check that only allowed tables are referenced
        foreach (self::$ALLOWED_TABLES as $table) {
            // Allow references to whitelisted tables
        }
        // Simple check: extract all table-like references after FROM/JOIN
        if (preg_match_all('/(?:FROM|JOIN)\s+`?(\w+)`?/i', $sql, $matches)) {
            foreach ($matches[1] as $referenced) {
                if (!in_array($referenced, self::$ALLOWED_TABLES)) {
                    error_log("[AIController] Blocked query referencing table: $referenced");
                    return false;
                }
            }
        }

        return true;
    }

    // ── LLM API calls ──────────────────────────────────────────────────────

    private function callGemini($systemPrompt, $userMessage, $history) {
        $apiKey = env('AI_GEMINI_KEY', '');
        if (empty($apiKey)) return null;

        $contents = [];

        // Add conversation history
        foreach ($history as $msg) {
            $role = ($msg['role'] === 'user') ? 'user' : 'model';
            $contents[] = ['role' => $role, 'parts' => [['text' => $msg['content']]]];
        }

        // Add current user message
        $contents[] = ['role' => 'user', 'parts' => [['text' => $userMessage]]];

        $payload = json_encode([
            'contents' => $contents,
            'systemInstruction' => ['parts' => [['text' => $systemPrompt]]],
            'generationConfig' => [
                'temperature' => 0.3,
                'maxOutputTokens' => 2048,
            ],
        ]);

        return $this->httpPost(
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=$apiKey",
            $payload,
            function ($data) {
                return $data['candidates'][0]['content']['parts'][0]['text'] ?? null;
            }
        );
    }

    private function callGeminiRaw($prompt, $systemInstruction) {
        $apiKey = env('AI_GEMINI_KEY', '');
        if (empty($apiKey)) return null;

        $payload = json_encode([
            'contents' => [['role' => 'user', 'parts' => [['text' => $prompt]]]],
            'systemInstruction' => ['parts' => [['text' => $systemInstruction]]],
            'generationConfig' => [
                'temperature' => 0.1,
                'maxOutputTokens' => 2048,
            ],
        ]);

        return $this->httpPost(
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=$apiKey",
            $payload,
            function ($data) {
                return $data['candidates'][0]['content']['parts'][0]['text'] ?? null;
            }
        );
    }

    private function callGroq($systemPrompt, $userMessage, $history) {
        $apiKey = env('AI_GROQ_KEY', '');
        if (empty($apiKey)) return null;

        $messages = [['role' => 'system', 'content' => $systemPrompt]];

        foreach ($history as $msg) {
            $messages[] = ['role' => $msg['role'], 'content' => $msg['content']];
        }

        $messages[] = ['role' => 'user', 'content' => $userMessage];

        $payload = json_encode([
            'model' => 'llama-3.3-70b-versatile',
            'messages' => $messages,
            'temperature' => 0.3,
            'max_tokens' => 1024,
        ]);

        return $this->httpPost(
            'https://api.groq.com/openai/v1/chat/completions',
            $payload,
            function ($data) {
                return $data['choices'][0]['message']['content'] ?? null;
            },
            ['Authorization: Bearer ' . $apiKey]
        );
    }

    private function callGroqRaw($prompt, $systemInstruction) {
        $apiKey = env('AI_GROQ_KEY', '');
        if (empty($apiKey)) return null;

        $payload = json_encode([
            'model' => 'llama-3.3-70b-versatile',
            'messages' => [
                ['role' => 'system', 'content' => $systemInstruction],
                ['role' => 'user', 'content' => $prompt],
            ],
            'temperature' => 0.1,
            'max_tokens' => 512,
        ]);

        return $this->httpPost(
            'https://api.groq.com/openai/v1/chat/completions',
            $payload,
            function ($data) {
                return $data['choices'][0]['message']['content'] ?? null;
            },
            ['Authorization: Bearer ' . $apiKey]
        );
    }

    private function httpPost($url, $payload, $extractFn, $extraHeaders = []) {
        $headers = array_merge(['Content-Type: application/json'], $extraHeaders);

        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $payload,
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 30,
            CURLOPT_SSL_VERIFYPEER => false,
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);

        if ($error) {
            error_log("[AIController] cURL error ($url): $error");
            return null;
        }

        if ($httpCode !== 200) {
            error_log("[AIController] HTTP $httpCode from $url: $response");
            return null;
        }

        $data = json_decode($response, true);
        if (!$data) return null;

        return $extractFn($data);
    }
}
