# Use an official PHP runtime with Apache
FROM php:8.2-apache

# Set working directory
WORKDIR /var/www/html

# Install system dependencies and PHP extensions
# We need PDO and MySQL extensions based on your backend files
RUN apt-get update && apt-get install -y \
    libzip-dev \
    zip \
    unzip \
    && docker-php-ext-install pdo pdo_mysql zip

# Enable Apache modules needed for the application
# mod_rewrite is essential for routing requests to index.php
# mod_headers is used for CORS configurations in .htaccess
RUN a2enmod rewrite headers

# Copy the application files into the container
# This copies everything from the current directory (where the Dockerfile is)
COPY . /var/www/html/

# Update Apache configuration to allow overrides (so .htaccess works)
# By default, Apache in this image ignores .htaccess files
RUN sed -i 's/AllowOverride None/AllowOverride All/' /etc/apache2/apache2.conf

# Important: The .htaccess file must be present and correctly configured
# for the routing to work, particularly the SSE stream buffering rules.

# Set appropriate permissions for the application files
# The www-data user (Apache) needs ownership to serve files and write to uploads
RUN chown -R www-data:www-data /var/www/html/
RUN chmod -R 755 /var/www/html/

# Specifically ensure the uploads directories exist and are writable
# Based on the file structure provided, the application uses these directories
RUN mkdir -p /var/www/html/uploads/tickets \
    && chown -R www-data:www-data /var/www/html/uploads \
    && chmod -R 775 /var/www/html/uploads

# Expose port 80 to the outside world
EXPOSE 80

# The base image already has a CMD that starts Apache in the foreground
# So we don't need to specify one explicitly.
