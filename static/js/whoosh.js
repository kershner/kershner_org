let whoosh = {
};

whoosh.init = function() {

};


whoosh.populateUserAgent = function() {
    let userAgentInput = document.getElementById('id_user_agent');
    userAgentInput.value = window.navigator.userAgent;
};
