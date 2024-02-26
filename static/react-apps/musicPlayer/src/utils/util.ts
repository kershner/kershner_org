export const fetchWrapper = (endpoint: RequestInfo, method: String, params={}, headers={}, callback: Function) => {
    const callParams: any = {
        headers     : headers,
        method      : method,
        credentials : 'include',
        mode        : 'same-origin'
    };
    if (params instanceof FormData) {
        callParams['body'] = params
    } else {
        if (method.toLowerCase() === 'post') {
            callParams['body'] = JSON.stringify(params);
        }
    }

    fetch(endpoint, callParams)
    .then((response) => {
        return response.text();
    })
    .then((data) => {
        let response = JSON.parse(data);
        callback(response);
    })
    .catch(function(ex) {
        console.log(ex);
    });
}