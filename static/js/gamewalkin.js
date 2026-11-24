(() => {
    const $ = selector => document.querySelector(selector);
    const streams = [...document.querySelectorAll('.stream')];
    const channels = streams.map(stream => stream.dataset.channel);
    const controls = [...document.querySelectorAll('[data-setting]')];
    const players = new Map(); // Ready players only.
    const live = new Map(); // Unknown channels remain visible until Twitch reports a status.
    const autoPaused = new Set();
    const chat = $('#chat');
    const menus = [...document.querySelectorAll('details')];
    function closeMenus(except) {
        menus.forEach(menu => { if (menu !== except) menu.open = false; });
    }
    menus.forEach(menu => menu.addEventListener('toggle', () => {
        if (menu.open) closeMenus(menu);
    }));
    document.addEventListener('click', event => {
        if (!event.target.closest('details')) closeMenus();
    });
    document.addEventListener('keydown', event => {
        if (event.key !== 'Escape') return;
        const openMenu = menus.find(menu => menu.open);
        if (!openMenu) return;
        if (openMenu.contains(document.activeElement)) openMenu.querySelector('summary').focus();
        closeMenus();
    });
    chat.addEventListener('load', () => { delete chat.dataset.loading; });
    const names = Object.fromEntries(streams.map(stream => [stream.dataset.channel, stream.getAttribute('aria-label')]));
    let touring = false;
    let tourTimer;

    function readControls() {
        return Object.fromEntries(controls.map(control => [control.name,
            control.type === 'checkbox' ? control.checked :
                control.type === 'number' ? control.valueAsNumber : control.value
        ]));
    }

    const defaults = { focused: channels[0], ...readControls() };
    function normalize(input) {
        const values = { ...defaults };
        if (!input || typeof input !== 'object') return values;
        controls.forEach(control => {
            const value = input[control.name];
            if (control.type === 'checkbox' && typeof value === 'boolean') {
                values[control.name] = value;
            } else if (control.type === 'number' && Number.isFinite(value)) {
                values[control.name] = Math.round(Math.max(Number(control.min), Math.min(Number(control.max), value)));
            } else if (control.tagName === 'SELECT' && [...control.options].some(option => option.value === value)) {
                values[control.name] = value;
            }
        });
        if (channels.includes(input.focused)) values.focused = input.focused;
        return values;
    }

    let state = { ...defaults };
    try { state = normalize(JSON.parse(localStorage.getItem('gamewalkin') || localStorage.getItem('walk'))); }
    catch (_) { /* Storage may be unavailable. */ }
    state.muted = true; // Never restore sound or start a tour without a user action.

    const liveChannels = () => channels.filter(channel => live.get(channel) === true);
    const availableChannels = () => channels.filter(channel => !state.hideOffline || live.get(channel) !== false);
    const resolveChannel = value => value === 'follow' ? state.focused : value;
    const playbackAllowed = channel => state.background || channel === state.focused || (!state.muted && channel === resolveChannel(state.audio));
    const focusChoices = () => touring ? liveChannels() : availableChannels();

    function applyAudio() {
        const source = state.muted ? null : resolveChannel(state.audio);
        players.forEach((player, channel) => { if (channel !== source) player.setMuted(true); });
        players.get(source)?.setMuted(false);
    }

    function applyPlayback(player, channel) {
        const allowed = playbackAllowed(channel);
        if (!allowed && !player.isPaused()) {
            autoPaused.add(channel);
            player.pause();
        } else if (allowed && autoPaused.delete(channel)) {
            player.play();
        }
    }

    function scheduleTour() {
        clearTimeout(tourTimer);
        const candidates = liveChannels();
        if (!touring || candidates.length < 2) return;
        const others = candidates.filter(channel => channel !== state.focused);
        const next = state.shuffle ? others[Math.floor(Math.random() * others.length)] :
            candidates[(candidates.indexOf(state.focused) + 1) % candidates.length];
        tourTimer = setTimeout(() => select(next), state.interval * 1000);
    }

    function update() {
        const available = availableChannels();
        const choices = focusChoices();
        if (!choices.length) choices.push(...available);
        if (choices.length && !choices.includes(state.focused)) state.focused = choices[0];
        controls.forEach(control => {
            // Player events and Tour must not overwrite an in-progress edit.
            if (control === document.activeElement) return;
            if (control.type === 'checkbox') control.checked = state[control.name];
            else control.value = state[control.name];
        });
        $('#streams').dataset.layout = state.layout;
        document.body.classList.toggle('compact', state.compact);
        $('#viewer').dataset.chatPosition = state.chatPosition;
        let visibleCount = 0;
        streams.forEach(stream => {
            const channel = stream.dataset.channel;
            const selected = channel === state.focused;
            stream.classList.toggle('selected', selected);
            stream.hidden = !available.includes(channel) ||
                (state.layout === 'cinema' && !selected);
            if (!stream.hidden) visibleCount++;
            stream.querySelector('.focus-stream').setAttribute('aria-pressed', String(selected));
        });
        $('#streams').dataset.count = visibleCount;
        $('#streams').hidden = !available.length;
        $('#empty').hidden = !!available.length;
        $('#chat-panel').hidden = !state.chatOpen;
        if (state.chatOpen) {
            const channel = resolveChannel(state.chatChannel);
            const url = `https://www.twitch.tv/embed/${channel}/chat?darkpopout&parent=${encodeURIComponent(location.hostname)}`;
            if (chat.getAttribute('src') !== url) {
                chat.dataset.loading = 'true';
                chat.src = url;
            }
            chat.title = `${names[channel]} chat`;
        }
        applyAudio();
        players.forEach(applyPlayback);
        try { localStorage.setItem('gamewalkin', JSON.stringify(state)); }
        catch (_) { $('#message').textContent = 'Browser storage is unavailable; changes will last for this visit.'; }
        $('#tour-toggle').checked = touring;
        scheduleTour();
    }

    function select(channel, toggle = false) {
        if (!availableChannels().includes(channel)) return;
        const player = players.get(channel);
        const pause = toggle && channel === state.focused && player && !player.isPaused();
        if (pause || (touring && !liveChannels().includes(channel))) touring = false;
        state.focused = channel;
        update();
        autoPaused.delete(channel);
        if (pause) player.pause();
        else player?.play();
    }

    function step(direction) {
        const choices = focusChoices();
        if (choices.length) select(choices[(choices.indexOf(state.focused) + direction + choices.length) % choices.length]);
    }

    function toggleTour() {
        touring = !touring;
        update();
        if (touring && live.get(state.focused)) players.get(state.focused)?.play();
    }

    async function fullscreen() {
        try {
            if (document.fullscreenElement) await document.exitFullscreen();
            else await document.documentElement.requestFullscreen();
        } catch (_) { $('#message').textContent = 'Fullscreen is unavailable in this browser.'; $('#settings').open = true; }
        finally { $('#fullscreen').checked = !!document.fullscreenElement; }
    }
    $('#fullscreen').disabled = !document.fullscreenEnabled;
    document.addEventListener('fullscreenchange', () => {
        $('#fullscreen').checked = !!document.fullscreenElement;
    });

    $('#fullscreen').addEventListener('change', fullscreen);
    $('#tour-toggle').addEventListener('change', toggleTour);
    document.addEventListener('change', event => {
        if (!event.target.matches('[data-setting]')) return;
        state = normalize({ focused: state.focused, ...readControls() });
        if (event.target.type === 'number') event.target.value = state[event.target.name];
        update();
    });
    const shortcuts = {
        ...Object.fromEntries(channels.map((channel, index) => [index + 1, () => select(channel)])),
        arrowleft: () => step(-1), arrowright: () => step(1),
        m: () => { state.muted = true; update(); },
        t: toggleTour, f: fullscreen, c: () => { state.chatOpen = !state.chatOpen; update(); }
    };
    document.addEventListener('keydown', event => {
        if (event.target.closest('input, select, textarea, button, summary, a, [contenteditable]') || event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
        const action = shortcuts[event.key.toLowerCase()];
        if (!action) return;
        event.preventDefault();
        action();
    });

    const events = {
        ONLINE: 'Live', OFFLINE: 'Offline', PLAYING: 'Playing', PAUSE: 'Paused', ENDED: 'Ended',
        PLAYBACK_BLOCKED: 'Click the stream name to play', ERROR: 'Player error. Try the Twitch link in Links.'
    };
    streams.forEach(stream => {
        const channel = stream.dataset.channel;
        const status = stream.querySelector('.status');
        const button = stream.querySelector('.focus-stream');
        const symbol = stream.querySelector('.playback-symbol');
        button.addEventListener('click', () => select(channel, true));
        if (!window.Twitch) { status.textContent = 'Player unavailable. Use the Twitch link or reload.'; return; }
        stream.dataset.loading = 'true';
        const player = new Twitch.Player(`player-${channel}`, {
            channel, width: '100%', height: '100%', parent: [location.hostname], autoplay: true, muted: true
        });
        player.addEventListener(Twitch.Player.READY, () => {
            players.set(channel, player);
            delete stream.dataset.loading;
            status.textContent = 'Ready';
            update();
        });
        Object.entries(events).forEach(([event, label]) => player.addEventListener(Twitch.Player[event], () => {
            status.textContent = label;
            symbol.textContent = player.isPaused() ? '\u25b6' : '\u23f8';
            if (event === 'ONLINE' || event === 'OFFLINE') {
                live.set(channel, event === 'ONLINE');
                update();
            }
            // Autoplay can finish after a background-pause setting was applied.
            if (event === 'PLAYING') applyPlayback(player, channel);
        }));
    });
    update();
})();
