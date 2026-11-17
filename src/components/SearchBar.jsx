import { useState } from 'react';

export default function SearchBar({ onSearch, value, onChange }) {
  const [internalValue, setInternalValue] = useState('');
  const searchTerm = value === undefined ? internalValue : value;
  const setSearchTerm = onChange || setInternalValue;
  return (
    <form className="search-form" role="search" onSubmit={(event) => {
      event.preventDefault();
      onSearch(searchTerm.trim());
    }}>
      <label htmlFor="headline-search">Search headlines</label>
      <div className="search-controls">
        <input id="headline-search" type="search" value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)} placeholder="Topic, place or publisher" />
        <button type="submit" className="primary-button">Search</button>
        {searchTerm && <button type="button" onClick={() => { setSearchTerm(''); onSearch(''); }}>Clear search</button>}
      </div>
    </form>
  );
}
