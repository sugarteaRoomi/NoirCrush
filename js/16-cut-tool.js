// ============================================================
// Cut Video — remove a chunk from a single video and export
// ============================================================
var cutBtn = document.getElementById('cutBtn');
var cutPanel = document.getElementById('cutPanel');
var cutCloseBtn = document.getElementById('cutCloseBtn');
var cutVideoLabel = document.getElementById('cutVideoLabel');
var cutVideoLibraryBtn = document.getElementById('cutVideoLibraryBtn');
var cutVideoUploadBtn = document.getElementById('cutVideoUploadBtn');
var cutVideoFile = document.getElementById('cutVideoFile');
var cutControls = document.getElementById('cutControls');
var cutSetStartBtn = document.getElementById('cutSetStartBtn');
var cutSetEndBtn = document.getElementById('cutSetEndBtn');
var cutStartFineLeft = document.getElementById('cutStartFineLeft');
var cutStartFineRight = document.getElementById('cutStartFineRight');
var cutEndFineLeft = document.getElementById('cutEndFineLeft');
var cutEndFineRight = document.getElementById('cutEndFineRight');
var cutStartDisplay = document.getElementById('cutStartDisplay');
var cutEndDisplay = document.getElementById('cutEndDisplay');
var cutExportBtn = document.getElementById('cutExportBtn');
var cutExportProgress = document.getElementById('cutExportProgress');

var cutVideoName = null;
var cutStart = null;
var cutEnd = null;
var _cutPicking = null;
var _cutFile = null;

var _playerControls = document.querySelector('#playerSection > .controls');

// --- Open/Close ---
cutBtn.addEventListener('click', function() {
    // Cut exports the raw file, so mirror has no effect here — start from Original.
    if (isMirrored) mirrorBtn.click();
    _playerControls.style.display = 'none';
    cutPanel.style.display = 'block';
    cutBtn.style.display = 'none';
    setPracticePanels(false);
});
cutCloseBtn.addEventListener('click', closeCutPanel);

function closeCutPanel() {
    cutPanel.style.display = 'none';
    cutBtn.style.display = '';
    _playerControls.style.display = '';
    setPracticePanels(true);
    cutVideoName = null;
    cutStart = null;
    cutEnd = null;
    cutVideoLabel.textContent = 'None selected';
    cutStartDisplay.textContent = 'Start: —';
    cutEndDisplay.textContent = 'End: —';
    cutControls.style.display = 'none';
    _cutPicking = null;
    _cutFile = null;
    if (_cutBSwapped) _endCutSwap();
    if (cutVideoB) { cutVideoB.pause(); cutVideoB.style.display = 'none'; }
    _restoreCutPanelHome();
}

// Once a video is picked, move the panel below the player controls so the
// seek bar stays visible while adjusting timestamps.
var _cutPanelHome = null;
function _moveCutPanelBelowVideo() {
    if (_cutPanelHome) return;
    _cutPanelHome = { parent: cutPanel.parentNode, next: cutPanel.nextSibling };
    var ps = document.getElementById('playerSection');
    var anchor = ps.querySelector('.video-info') || ps.querySelector('.controls');
    if (anchor && anchor.nextSibling) ps.insertBefore(cutPanel, anchor.nextSibling);
    else ps.appendChild(cutPanel);
}
function _restoreCutPanelHome() {
    if (!_cutPanelHome) return;
    _cutPanelHome.parent.insertBefore(cutPanel, _cutPanelHome.next);
    _cutPanelHome = null;
}

// --- Video picking ---
function startCutPicking() {
    if (_cutPicking === 'video') { stopCutPicking(); return; }
    _cutPicking = 'video';
    cutVideoLibraryBtn.textContent = 'Click a video in the library...';
    cutVideoLibraryBtn.style.color = 'var(--accent)';
}
function stopCutPicking() {
    _cutPicking = null;
    cutVideoLibraryBtn.textContent = 'Pick from Library';
    cutVideoLibraryBtn.style.color = '';
}
cutVideoLibraryBtn.addEventListener('click', startCutPicking);

videoList.addEventListener('click', function(e) {
    if (cutPanel.style.display !== 'block') return;
    var li = e.target.closest('li');
    if (!li) return;
    var name = li.getAttribute('data-name');
    if (!name) return;
    e.stopPropagation();
    e.preventDefault();
    if (_cutPicking === 'video') {
        setCutVideo(name);
        stopCutPicking();
    }
}, true);

function setCutVideo(name) {
    cutVideoName = name;
    cutVideoLabel.textContent = name;
    _cutFile = null;
    loadVideoFromLibrary(name);
    cutControls.style.display = 'block';
    cutStart = null;
    cutEnd = null;
    updateCutDisplay();
    if (cutPanel.style.display === 'block') _moveCutPanelBelowVideo();
}

cutVideoUploadBtn.addEventListener('click', function() { cutVideoFile.click(); });
cutVideoFile.addEventListener('change', async function() {
    var f = cutVideoFile.files[0];
    if (!f) return;
    cutVideoFile.value = '';
    cutVideoLabel.textContent = 'Adding...';
    try {
        var name = await saveLibraryVideo(f);
        setCutVideo(name);
        _cutFile = f;
        renderLibrary();
    } catch(e) {
        cutVideoLabel.textContent = 'Could not add: ' + e.message;
    }
});

// --- Set cut points ---
cutSetStartBtn.addEventListener('click', function() {
    cutStart = getActiveVideo().currentTime;
    if (cutEnd !== null && cutEnd <= cutStart) cutEnd = null;
    updateCutDisplay();
});
cutSetEndBtn.addEventListener('click', function() {
    cutEnd = getActiveVideo().currentTime;
    if (cutStart !== null && cutStart >= cutEnd) cutStart = null;
    updateCutDisplay();
});

var CUT_FINE = 1 / 30;
function _cutDuration() {
    var dur = videoPlayer.duration;
    return (isNaN(dur) || !isFinite(dur) || dur <= 0) ? Infinity : dur;
}
function nudgeCutStart(delta) {
    if (cutStart === null) return;
    var dur = _cutDuration();
    cutStart = Math.max(0, Math.min(dur, cutStart + delta));
    if (cutEnd !== null && cutEnd <= cutStart) cutEnd = null;
    updateCutDisplay();
}
function nudgeCutEnd(delta) {
    if (cutEnd === null) return;
    var dur = _cutDuration();
    cutEnd = Math.max(0, Math.min(dur, cutEnd + delta));
    if (cutStart !== null && cutStart >= cutEnd) cutStart = null;
    updateCutDisplay();
}
cutStartFineLeft.addEventListener('click', function() { nudgeCutStart(-CUT_FINE); });
cutStartFineRight.addEventListener('click', function() { nudgeCutStart(CUT_FINE); });
cutEndFineLeft.addEventListener('click', function() { nudgeCutEnd(-CUT_FINE); });
cutEndFineRight.addEventListener('click', function() { nudgeCutEnd(CUT_FINE); });

function updateCutDisplay() {
    cutStartDisplay.textContent = 'Start: ' + (cutStart !== null ? formatTimePrecise(cutStart) : '—');
    cutEndDisplay.textContent = 'End: ' + (cutEnd !== null ? formatTimePrecise(cutEnd) : '—');
    if (cutStart !== null && cutEnd !== null) {
        if (_ensureCutB()) _parkCutB();
    }
}

// --- Preview: seamless skip over the cut region using a pre-loaded copy ---
var cutVideoB = null;
var _cutBSwapped = false;
var _cutBActivating = false;

function _ensureCutB() {
    var src = videoPlayer.currentSrc || videoPlayer.src;
    if (!src) return null;
    if (!cutVideoB) {
        cutVideoB = document.createElement('video');
        cutVideoB.playsinline = true;
        cutVideoB.preload = 'auto';
        cutVideoB.style.cssText = 'position:absolute;top:0;left:0;width:100%;max-height:540px;background:#000;display:none;';
        videoWrap.appendChild(cutVideoB);
        cutVideoB.addEventListener('loadedmetadata', function() { _parkCutB(); });
        cutVideoB.addEventListener('timeupdate', updateTimeDisplay);
        cutVideoB.addEventListener('play', updatePlayPauseBtn);
        cutVideoB.addEventListener('pause', updatePlayPauseBtn);
        cutVideoB.addEventListener('ended', function() { _endCutSwap(); });
        cutVideoB.addEventListener('click', function() {
            if (cutVideoB.paused) cutVideoB.play(); else cutVideoB.pause();
        });
        cutVideoB.addEventListener('dblclick', function(e) {
            e.preventDefault();
            fullscreenBtn.click();
        });
    }
    var curSrc = cutVideoB.currentSrc || cutVideoB.src;
    if (curSrc !== src) {
        cutVideoB.pause();
        cutVideoB.src = src;
    }
    return cutVideoB;
}

function _parkCutB() {
    if (_cutBSwapped || !cutVideoB || cutEnd === null) return;
    if (!(cutVideoB.currentSrc || cutVideoB.src)) return;
    if (cutVideoB.readyState === 0) return;
    if (Math.abs(cutVideoB.currentTime - cutEnd) > 0.001) {
        try { cutVideoB.currentTime = cutEnd; } catch (e) {}
    }
}

function _cutBReady() {
    if (!cutVideoB || _cutBSwapped) return false;
    var src = videoPlayer.currentSrc || videoPlayer.src;
    if ((cutVideoB.currentSrc || cutVideoB.src) !== src) return false;
    return cutVideoB.readyState >= 2 && !cutVideoB.seeking &&
           Math.abs(cutVideoB.currentTime - cutEnd) < 0.05;
}

function _endCutSwap() {
    if (!_cutBSwapped) return;
    _cutBSwapped = false;
    var t = cutVideoB.currentTime;
    cutVideoB.pause();
    cutVideoB.style.display = 'none';
    videoPlayer.currentTime = t;
    updatePlayPauseBtn();
    updateTimeDisplay();
}

function _trySwapToB() {
    if (_cutBSwapped || _cutBActivating) return;
    if (!_cutBReady()) {
        videoPlayer.currentTime = cutEnd;
        return;
    }
    _cutBActivating = true;
    videoPlayer.pause();
    cutVideoB.style.display = 'block';
    var p = cutVideoB.play();
    if (p) p.catch(function() {});
    _cutBSwapped = true;
    _cutBActivating = false;
    updatePlayPauseBtn();
    updateTimeDisplay();
}

// Frame-level crossing watch: catches the boundary before the loose
// timeupdate signal does, so nothing from the removed section plays
videoPlayer.addEventListener('timeupdate', function() {
    if (_cutBSwapped) return;
    var t = videoPlayer.currentTime;
    if (cutPanel.style.display === 'block' &&
        cutStart !== null && cutEnd !== null &&
        !videoPlayer.paused && !videoPlayer.seeking &&
        t >= cutStart && t < cutEnd) {
        _trySwapToB();
    } else if (t < cutStart) {
        _parkCutB();
    }
});

if (videoPlayer.requestVideoFrameCallback) {
    (function() {
        var armed = false;
        function tick(now, meta) {
            armed = false;
            var active = cutPanel.style.display === 'block' &&
                         cutStart !== null && cutEnd !== null &&
                         !videoPlayer.paused && !_cutBSwapped;
            if (active && !videoPlayer.seeking &&
                meta.mediaTime >= cutStart && meta.mediaTime < cutEnd) {
                _trySwapToB();
                return;
            }
            if (active && videoPlayer.currentTime < cutStart) {
                armed = true;
                videoPlayer.requestVideoFrameCallback(tick);
            }
        }
        setInterval(function() {
            if (armed) return;
            var active = cutPanel.style.display === 'block' &&
                         cutStart !== null && cutEnd !== null &&
                         !videoPlayer.paused && !_cutBSwapped &&
                         !videoPlayer.seeking && videoPlayer.currentTime < cutStart;
            if (active) {
                armed = true;
                videoPlayer.requestVideoFrameCallback(tick);
            }
        }, 300);
    })();
}

// While the copy is showing, route shared controls through it
(function() {
    var origSeek = seekToTime;
    seekToTime = function(t) {
        if (_cutBSwapped) _endCutSwap();
        origSeek(t);
    };
    var origActive = getActiveVideo;
    getActiveVideo = function() {
        return _cutBSwapped ? cutVideoB : origActive();
    };
})();

var cutTestBtn = document.getElementById('cutTestBtn');
cutTestBtn.addEventListener('click', function() {
    if (cutStart === null) return;
    seekToTime(Math.max(0, cutStart - 3));
    var av = getActiveVideo();
    if (av.paused) {
        var p = av.play();
        if (p && p.catch) p.catch(function() {});
    }
});

// --- Export (in-browser, via Mediabunny/WebCodecs) ---
cutExportBtn.addEventListener('click', async function() {
    if (!cutVideoName || cutStart === null || cutEnd === null) {
        cutExportProgress.style.display = 'block';
        cutExportProgress.textContent = 'Select a video and set start/end first.';
        setTimeout(function() { cutExportProgress.style.display = 'none'; }, 3000);
        return;
    }
    if (typeof Mediabunny === 'undefined' || !('VideoEncoder' in window)) {
        cutExportProgress.style.display = 'block';
        cutExportProgress.textContent = 'Cutting needs a modern browser like Chrome or Edge.';
        return;
    }
    cutExportBtn.disabled = true;
    cutExportProgress.style.display = 'block';
    cutExportProgress.textContent = 'Loading video... 0%';

    try {
        var source = _cutFile;
        if (!source) {
            source = await getLibraryFile(cutVideoName);
        }

        var M = Mediabunny;
        var input = new M.Input({
            formats: M.ALL_FORMATS,
            source: new M.BlobSource(source)
        });
        var videoTrack = await input.getPrimaryVideoTrack();
        if (!videoTrack) throw new Error('This file has no video track.');
        var audioTrack = await input.getPrimaryAudioTrack();

        var vCodec = await M.getFirstEncodableVideoCodec(['avc', 'hevc', 'vp9', 'av1'], {
            width: videoTrack.displayWidth,
            height: videoTrack.displayHeight
        });
        if (!vCodec) throw new Error("This browser can't encode video.");
        var aCodec = null;
        if (audioTrack) {
            aCodec = await M.getFirstEncodableAudioCodec(['aac', 'opus'], {
                numberOfChannels: audioTrack.numberOfChannels,
                sampleRate: audioTrack.sampleRate
            });
        }

        var dur = await input.computeDuration();
        var segments = [[0, cutStart], [cutEnd, dur]].filter(function(sg) {
            return sg[1] - sg[0] > 0.001;
        });

        var output = new M.Output({
            format: new M.Mp4OutputFormat(),
            target: new M.BufferTarget()
        });
        var vSource = new M.VideoSampleSource({ codec: vCodec, quality: new M.Quality('high') });
        output.addVideoTrack(vSource, { rotation: videoTrack.rotation });
        var aSource = null;
        if (audioTrack && aCodec) {
            aSource = new M.AudioSampleSource({ codec: aCodec, quality: new M.Quality('high') });
            output.addAudioTrack(aSource);
        }

        await output.start();

        var vSink = new M.VideoSampleSink(videoTrack);
        var aSink = audioTrack ? new M.AudioSampleSink(audioTrack) : null;
        var totalDur = 0;
        segments.forEach(function(sg) { totalDur += sg[1] - sg[0]; });
        var doneDur = 0;

        // Smooth progress: updates continuously but throttled so the DOM
        // isn't hammered for every single frame.
        var lastUiTick = 0;
        function _setExportPct(frac) {
            var now = Date.now();
            if (now - lastUiTick < 200 || frac >= 1) return;
            lastUiTick = now;
            cutExportProgress.textContent =
                'Exporting... ' + Math.min(99, Math.max(1, Math.round(frac * 100))) + '%';
        }

        for (var i = 0; i < segments.length; i++) {
            var segStart = segments[i][0], segEnd = segments[i][1];
            var segLen = segEnd - segStart;
            var iterV = vSink.samples(segStart, segEnd);
            for (var r = await iterV.next(); !r.done; r = await iterV.next()) {
                var localT = Math.min(segLen, Math.max(0, r.value.timestamp - segStart));
                _setExportPct((doneDur + localT) / totalDur);
                r.value.setTimestamp(Math.max(0, r.value.timestamp - segStart) + doneDur);
                await vSource.add(r.value);
                r.value.close();
            }
            if (aSink && aSource) {
                var iterA = aSink.samples(segStart, segEnd);
                for (var ra = await iterA.next(); !ra.done; ra = await iterA.next()) {
                    ra.value.setTimestamp(Math.max(0, ra.value.timestamp - segStart) + doneDur);
                    await aSource.add(ra.value);
                    ra.value.close();
                }
            }
            doneDur += segLen;
            lastUiTick = 0;
            _setExportPct(doneDur / totalDur);
        }

        cutExportProgress.textContent = 'Finishing up the file...';
        await output.finalize();

        var blob = new Blob([output.target.buffer], { type: 'video/mp4' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = cutVideoName.replace(/\.[^.]+$/, '') + '-cut.mp4';
        a.click();
        setTimeout(function() { URL.revokeObjectURL(url); }, 10000);
        cutExportProgress.textContent = 'Done! Saved ' + formatFileSize(blob.size) + ' to your downloads.';
    } catch(e) {
        cutExportProgress.textContent = 'Export failed: ' + e.message;
    }
    cutExportBtn.disabled = false;
});
