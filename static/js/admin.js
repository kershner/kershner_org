let customAdmin = {};

customAdmin.init = function() {
    customAdmin.autoCompleteListFilters();
};

customAdmin.autoCompleteListFilters = function() {
    let filters = document.querySelector('#changelist-filter').querySelectorAll('details');
    filters.forEach(element => {
        convertFilterToAutoComplete(element);
    });

    function convertFilterToAutoComplete(listFilterElement) {
        let filterName = listFilterElement.dataset.filterTitle;
        let newFilterId = `${filterName.replace(/\s+/g, '-')}-autocomplete-filter`;
        let filterValues = [];
        let filterLinks = {};
        let selectedText = listFilterElement.querySelector('li.selected').textContent;

        addClass(listFilterElement, 'hidden');

        listFilterElement.querySelectorAll('a').forEach((element, item) => {
            filterValues.push(element.textContent);
            filterLinks[element.textContent] = element.getAttribute('href');
        });

        let newHeader = document.createElement('h3');
        newHeader.textContent = `By ${filterName}`;
        listFilterElement.insertAdjacentElement('afterend', newHeader);

        let newInput = document.createElement('input');
        newInput.setAttribute('id', newFilterId);
        newInput.value = selectedText;
        newHeader.insertAdjacentElement('afterend', newInput);

        const listFilterAutocomplete = new autoComplete({
            selector: `#${newFilterId}`,
            placeHolder: `Filter by ${filterName}...`,
            data: {
                src: filterValues
            },
            threshold: 0,
            resultsList: {
                maxResults: undefined
            },
            events: {
                input: {
                    focus: () => {
                        listFilterAutocomplete.input.value = '';
                        listFilterAutocomplete.start();
                    }
                },
                list: {
                    click: (e) => {
                        let filterValue = e.target.textContent;
                        let link = filterLinks[filterValue];
                        window.location.href = link;
                    }
                }
            }
        });
    }
};