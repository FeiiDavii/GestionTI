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
      backgroundColor: state.isFocused ? 'var(--surface-primary)' : 'var(--input-bg)',
      borderColor: state.isFocused ? 'var(--primary-color)' : 'var(--border-color)',
      boxShadow: state.isFocused ? '0 0 0 3px var(--primary-light)' : 'none',
      borderRadius: 'var(--radius-md, 10px)',
      padding: '0 6px',
      minHeight: '40px',
      fontSize: '13.5px',
      transition: 'background-color 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease',
      cursor: isDisabled ? 'not-allowed' : 'pointer',
      opacity: isDisabled ? 0.6 : 1,
      '&:hover': {
        borderColor: state.isFocused ? 'var(--primary-color)' : 'var(--border-strong)',
      },
    }),
    valueContainer: (provided) => ({
      ...provided,
      padding: '2px 6px',
    }),
    menu: (provided) => ({
      ...provided,
      backgroundColor: 'var(--surface-primary)',
      borderRadius: '12px',
      border: '1px solid var(--border-color)',
      boxShadow: 'var(--shadow-lg)',
      zIndex: 9999,
      overflow: 'hidden',
      marginTop: '6px',
    }),
    menuList: (provided) => ({
      ...provided,
      padding: '6px',
    }),
    option: (provided, state) => ({
      ...provided,
      backgroundColor: state.isSelected
        ? 'var(--primary-color)'
        : state.isFocused
        ? 'var(--hover-bg)'
        : 'transparent',
      color: state.isSelected ? '#FFFFFF' : 'var(--text-color)',
      padding: '9px 12px',
      borderRadius: '8px',
      fontSize: '13.5px',
      fontWeight: state.isSelected ? 600 : 500,
      cursor: 'pointer',
      transition: 'background-color 0.12s ease, color 0.12s ease',
      ':active': {
        backgroundColor: 'var(--primary-color)',
        color: '#FFFFFF',
      },
    }),
    singleValue: (provided) => ({
      ...provided,
      color: 'var(--text-color)',
      fontSize: '13.5px',
      fontWeight: 500,
    }),
    input: (provided) => ({
      ...provided,
      color: 'var(--text-color)',
      fontSize: '13.5px',
    }),
    placeholder: (provided) => ({
      ...provided,
      color: 'var(--text-tertiary)',
      fontSize: '13.5px',
    }),
    indicatorSeparator: () => ({
      display: 'none',
    }),
    dropdownIndicator: (provided) => ({
      ...provided,
      color: 'var(--text-muted)',
      padding: '6px',
      ':hover': {
        color: 'var(--primary-color)',
      },
    }),
    clearIndicator: (provided) => ({
      ...provided,
      color: 'var(--text-muted)',
      padding: '6px',
      ':hover': {
        color: 'var(--error-color)',
      },
    }),
  };

  const formattedOptions = (options || []).map((opt) => {
    if (opt.value !== undefined && opt.label !== undefined) return opt;
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
