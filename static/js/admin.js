let customAdmin = {};

customAdmin.init = function() {
    customAdmin.autoCompleteListFilters();
};

customAdmin.autoCompleteListFilters = function() {
    /**
     * Convert Django 4+ changelist filters into simple autocomplete, styling not included
     * requires https://tarekraafat.github.io/autoComplete.js
     */
    let changelistFilters = document.querySelector('#changelist-filter');
    if (!changelistFilters) {
        return;
    }

    let filters = changelistFilters.querySelectorAll('details');
    filters.forEach(element => {
        convertFilterToAutoComplete(element);
    });

    function convertFilterToAutoComplete(listFilterElement) {
        const filterName = listFilterElement.dataset.filterTitle;
        const selectedText = listFilterElement.querySelector('li.selected').textContent;
        const newFilterId = `${filterName.replace(/\s+/g, '-')}-autocomplete-filter`;  // replace spaces with hyphen
        let filterLinks = {};

        // Build dictionary of {filterValue: filterLink}
        // i.e. {'5': '?number=5'}
        listFilterElement.querySelectorAll('a').forEach(element => {
            filterLinks[element.textContent] = element.getAttribute('href');
        });

        // Hide the existing filter
        addClass(listFilterElement, 'hidden');

        // Create, configure, and insert the HTML elements for the new autocomplete filters
        let newHeader = document.createElement('h3');
        newHeader.textContent = `By ${filterName}`;
        listFilterElement.insertAdjacentElement('afterend', newHeader);

        let newInput = document.createElement('input');
        newInput.setAttribute('id', newFilterId);
        newInput.value = selectedText;
        newHeader.insertAdjacentElement('afterend', newInput);

        // Initialize the autoComplete.js library
        // https://tarekraafat.github.io/autoComplete.js
        let storedFilterValue = '';
        const listFilterAutocomplete = new autoComplete({
            selector: `#${newFilterId}`,
            placeHolder: `Filter by ${filterName}...`,
            data: {
                src: Object.keys(filterLinks)
            },
            threshold: 0,
            resultsList: {
                maxResults: undefined
            },
            events: {
                input: {
                    focus: () => {
                        storedFilterValue = listFilterAutocomplete.input.value;
                        listFilterAutocomplete.input.value = '';
                        listFilterAutocomplete.start();
                    },
                    focusout: () => {
                        listFilterAutocomplete.input.value = storedFilterValue;
                    }
                },
                list: {
                    click: (e) => {
                        const filterValue = e.target.textContent;
                        window.location.href = filterLinks[filterValue];
                    }
                }
            }
        });
    }
};