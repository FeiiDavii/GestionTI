import React from 'react';
import Select from 'react-select';

export default function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = '-- Seleccionar --',
  isClearable = true,
  isDisabled = false,
  className = '',
}) {
  const customStyles = {
    control: (provided, state) => ({
      ...provided,
      backgroundColor: 'var(--input-bg)',
      borderColor: state.isFocused ? 'var(--primary-color)' : 'rgba(255, 255, 255, 0.08)',
      boxShadow: state.isFocused ? '0 0 0 4px rgba(74, 108, 247, 0.15)' : 'none',
      borderRadius: '12px',
      padding: '2px',
      minHeight: '48px',
      transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
      cursor: isDisabled ? 'not-allowed' : 'pointer',
      opacity: isDisabled ? 0.6 : 1,
    }),
    menu: (provided) => ({
      ...provided,
      backgroundColor: 'var(--card-bg)',
      borderRadius: '12px',
      border: '1px solid var(--border-color)',
      boxShadow: '0 10px 40px var(--shadow-color)',
      zIndex: 9999,
      overflow: 'hidden',
    }),
    menuList: (provided) => ({
      ...provided,
      padding: 0,
    }),
    option: (provided, state) => ({
      ...provided,
      backgroundColor: state.isSelected
        ? 'var(--primary-color)'
        : state.isFocused
        ? 'var(--hover-bg)'
        : 'transparent',
      color: state.isSelected ? '#fff' : 'var(--text-color)',
      padding: '12px 16px',
      cursor: 'pointer',
      transition: 'all 0.2s',
      ':active': {
        backgroundColor: 'var(--primary-color)',
        color: '#fff',
      },
    }),
    singleValue: (provided) => ({
      ...provided,
      color: 'var(--text-color)',
    }),
    input: (provided) => ({
      ...provided,
      color: 'var(--text-color)',
    }),
    placeholder: (provided) => ({
      ...provided,
      color: 'var(--gray-text)',
    }),
    indicatorSeparator: () => ({
      display: 'none',
    }),
    dropdownIndicator: (provided) => ({
      ...provided,
      color: 'var(--gray-text)',
      ':hover': {
        color: 'var(--primary-color)',
      },
    }),
    clearIndicator: (provided) => ({
      ...provided,
      color: 'var(--gray-text)',
      ':hover': {
        color: 'var(--error-color)',
      },
    }),
  };

  // Convert generic options array to { value, label } if not already in that format
  const formattedOptions = options.map((opt) => {
    if (opt.value !== undefined && opt.label !== undefined) return opt;
    // Default to id and nombre if properties exist
    return {
      value: opt.id || opt.value || opt,
      label: opt.nombre || opt.nombre_completo || opt.nombre_equipo || opt.nombre_area || opt.nombre_marca || opt.tipo || opt.ram_rom || opt.label || String(opt),
    };
  });

  const selectedValue = formattedOptions.find((opt) => opt.value === value) || null;

  return (
    <Select
      value={selectedValue}
      onChange={(selected) => onChange(selected ? selected.value : '')}
      options={formattedOptions}
      styles={customStyles}
      placeholder={placeholder}
      isClearable={isClearable}
      isDisabled={isDisabled}
      className={`searchable-select ${className}`}
      classNamePrefix="react-select"
      noOptionsMessage={() => 'No se encontraron resultados'}
    />
  );
}
