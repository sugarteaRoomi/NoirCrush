// ============================================================
// Keyboard Shortcuts
// ============================================================
document.addEventListener('keydown', function(e) {
    if (e.target.matches('input, textarea, select, [contenteditable="true"]')) return;

    var key = e.key;
    // 0 always jumps to start of video
    if (key === '0') {
        e.preventDefault();
        e.stopPropagation();
        jumpToMarker('0');
        return;
    }
    // Check if this key has a marker bound (takes priority over shortcuts)
    if (key in markers) {
        e.preventDefault();
        e.stopPropagation();
        jumpToMarker(key);
        return;
    }

    var cutEditing = typeof cutPanel !== 'undefined' && cutPanel && cutPanel.style.display === 'block';

    switch(key.toLowerCase()) {
        case 'm': if (!cutEditing) mirrorBtn.click(); break;
        case 'arrowleft': {
            var av = getActiveVideo(); seekToTime(Math.max(0, av.currentTime - 3));
            e.preventDefault(); break;
        }
        case 'arrowright': {
            var av2 = getActiveVideo(); seekToTime(Math.min(av2.duration || Infinity, av2.currentTime + 3));
            e.preventDefault(); break;
        }
        case 'arrowup': if (!cutEditing) setSpeed(currentSpeed + 0.05); e.preventDefault(); break;
        case 'arrowdown': if (!cutEditing) setSpeed(currentSpeed - 0.05); e.preventDefault(); break;
        case 'r': if (!cutEditing) setSpeed(1.0); break;
        case ' ':
            e.preventDefault();
            var sp = getActiveVideo(); if (sp.paused) sp.play(); else sp.pause();
            break;
        case 's': if (typeof cutTestBtn !== 'undefined') cutTestBtn.click(); e.preventDefault(); e.stopPropagation(); break;
        case ',': if (!cutEditing) loopStartBtn.click(); break;
        case '.': if (!cutEditing) loopEndBtn.click(); break;
        case '/': if (!cutEditing) loopPlayBtn.click(); break;
        case 'f': fullscreenBtn.click(); break;
    }
}, true);

// After mouse-clicking a button, release its focus so stray presses of
// Space/Enter don't re-trigger whichever button was clicked last.
document.addEventListener('click', function(e) {
    var b = e.target && e.target.closest ? e.target.closest('button') : null;
    if (b) b.blur();
}, true);
