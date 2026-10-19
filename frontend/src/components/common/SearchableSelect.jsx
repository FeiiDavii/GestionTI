import React from 'react';
import Select from 'react-select';
import CreatableSelect from 'react-select/creatable';

export default function SearchableSelect({
  options = [],
  value,
  onChange,
  placeholder = '-- Seleccionar --',
  isClearable = true,
  isDisabled = false,
  isCreatable = false,
  className = '',
}) {
  const customStyles = {
    control: (provided, state) => ({
      ...provided,
      backgroundColor: 'var(--input-bg)',
      borderColor: state.isFocused ? 'var(--primary-color)' : 'var(--border-color)',
      boxShadow: state.isFocused ? '0 0 0 2px var(--primary-light)' : 'none',
      borderRadius: '6px',
      padding: '0 4px',
      minHeight: '38px',
      height: '38px',
      fontSize: '13px',
      transition: 'all 0.15s ease',
      cursor: isDisabled ? 'not-allowed' : 'pointer',
      opacity: isDisabled ? 0.6 : 1,
    }),
    valueContainer: (provided) => ({
      ...provided,
      padding: '0 6px',
    }),
    menu: (provided) => ({
      ...provided,
      backgroundColor: 'var(--surface-primary)',
      borderRadius: '6px',
      border: '1px solid var(--border-color)',
      boxShadow: '0 10px 25px var(--shadow-color)',
      zIndex: 9999,
      overflow: 'hidden',
    }),
    menuList: (provided) => ({
      ...provided,
      padding: '4px',
    }),
    option: (provided, state) => ({
      ...provided,
      backgroundColor: state.isSelected
        ? 'var(--primary-color)'
        : state.isFocused
        ? 'var(--hover-bg)'
        : 'transparent',
      color: state.isSelected ? '#fff' : 'var(--text-color)',
      padding: '8px 12px',
      borderRadius: '4px',
      fontSize: '13px',
      cursor: 'pointer',
      transition: 'all 0.12s',
      ':active': {
        backgroundColor: 'var(--primary-color)',
        color: '#fff',
      },
    }),
    singleValue: (provided) => ({
      ...provided,
      color: 'var(--text-color)',
      fontSize: '13px',
    }),
    input: (provided) => ({
      ...provided,
      color: 'var(--text-color)',
      fontSize: '13px',
    }),
    placeholder: (provided) => ({
      ...provided,
      color: 'var(--text-tertiary)',
      fontSize: '13px',
    }),
    indicatorSeparator: () => ({
      display: 'none',
    }),
    dropdownIndicator: (provided) => ({
      ...provided,
      color: 'var(--text-muted)',
      padding: '4px',
      ':hover': {
        color: 'var(--primary-color)',
      },
    }),
    clearIndicator: (provided) => ({
      ...provided,
      color: 'var(--text-muted)',
      padding: '4px',
      ':hover': {
        color: 'var(--error-color)',
      },
    }),
  };

  // Convert generic options array to { value, label } if not already in that format
  const formattedOptions = (options || []).map((opt) => {
    if (opt.value !== undefined && opt.label !== undefined) return opt;
    // Default to id and nombre if properties exist
    return {
      value: opt.id || opt.value || opt,
      label: opt.nombre || opt.nombre_completo || opt.nombre_equipo || opt.nombre_area || opt.nombre_marca || opt.tipo || opt.ram_rom || opt.label || String(opt),
    };
  });

  let selectedValue = formattedOptions.find((opt) => String(opt.value) === String(value)) || null;
  if (!selectedValue && value != null && value !== '') {
    selectedValue = { value: value, label: String(value) };
    if (isCreatable) {
      formattedOptions.unshift(selectedValue);
    }
  }

  const SelectComponent = isCreatable ? CreatableSelect : Select;

  return (
    <SelectComponent
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
      formatCreateLabel={(inputValue) => `Usar "${inputValue}"`}
    />
  );
}
