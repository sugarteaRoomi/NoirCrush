// Video Library — stored privately in the visitor's own browser (OPFS).
// No server required: videos never leave the device.
//
// Public helpers used across modules:
//   renderLibrary(), loadVideoFromLibrary(name),
//   saveLibraryVideo(file) -> name,
//   deleteLibraryVideo(name),
//   getLibraryFile(name) -> File,
//   formatFileSize(bytes), escapeHTML(str)

var _libDirPromise = null;
var _currentObjectUrl = null;

function _libDir() {
    if (!_libDirPromise) {
        if (!navigator.storage || !navigator.storage.getDirectory) {
            _libDirPromise = Promise.reject(new Error("This browser can't store videos. Please use Chrome, Edge, or Safari."));
        } else {
            _libDirPromise = navigator.storage.getDirectory().then(function(root) {
                return root.getDirectoryHandle('videos', { create: true });
            });
        }
    }
    return _libDirPromise;
}

async function listLibraryVideos() {
    var dir = await _libDir();
    var names = [];
    for await (var entry of dir.values()) {
        if (entry.kind === 'file') names.push(entry.name);
    }
    names.sort(function(a, b) { return a.localeCompare(b); });
    var files = [];
    for (var i = 0; i < names.length; i++) {
        try {
            var fh = await dir.getFileHandle(names[i]);
            var f = await fh.getFile();
            files.push({ name: names[i], size: f.size });
        } catch (e) {}
    }
    return files;
}

function _sanitizeName(name) {
    return String(name || 'video.mp4').replace(/[\/\\]/g, '_').substring(0, 180);
}

async function _uniqueName(dir, wanted) {
    var base = _sanitizeName(wanted);
    var candidate = base;
    var n = 2;
    while (true) {
        try {
            await dir.getFileHandle(candidate);
            var dot = base.lastIndexOf('.');
            candidate = dot > 0
                ? base.slice(0, dot) + ' (' + n + ')' + base.slice(dot)
                : base + ' (' + n + ')';
            n++;
        } catch (e) {
            return candidate;
        }
    }
}

async function saveLibraryVideo(file) {
    var dir = await _libDir();
    var name = await _uniqueName(dir, file.name);
    var fh = await dir.getFileHandle(name, { create: true });
    var w = await fh.createWritable();
    try {
        await w.write(file);
    } finally {
        await w.close();
    }
    return name;
}

async function deleteLibraryVideo(name) {
    var dir = await _libDir();
    await dir.removeEntry(name);
}

async function getLibraryFile(name) {
    var dir = await _libDir();
    var fh = await dir.getFileHandle(name);
    return fh.getFile();
}

async function renderLibrary() {
    var files;
    try {
        files = await listLibraryVideos();
    } catch (e) {
        videoList.innerHTML = '<div class="empty-state"><p>' + escapeHTML(e.message) + '</p></div>';
        return;
    }

    if (!files.length) {
        videoList.innerHTML = '<div class="empty-state"><p>No videos yet. Videos you add stay on this device.</p></div>';
        return;
    }

    videoList.innerHTML = '';
    files.forEach(function(f) {
        var li = document.createElement('li');
        li.setAttribute('data-name', f.name);
        if (currentVideo && currentVideo.name === f.name) li.classList.add('active');
        li.innerHTML =
            '<span class="vname">' + escapeHTML(f.name) + '</span>' +
            '<span class="vmeta">' + formatFileSize(f.size) + '</span>' +
            '<button class="vid-delete" data-name="' + escapeHTML(f.name) + '" title="Delete video">&#x2715;</button>';
        videoList.appendChild(li);
        li.querySelector('.vid-delete').addEventListener('click', function(e) {
            e.stopPropagation();
            var delName = this.getAttribute('data-name');
            if (confirm('Delete "' + delName + '" from this device?')) {
                deleteLibraryVideo(delName).then(renderLibrary).catch(function(err) {
                    alert('Could not delete: ' + err.message);
                });
            }
        });
    });
}

async function loadVideoFromLibrary(filename) {
    var f;
    try {
        f = await getLibraryFile(filename);
    } catch (e) {
        alert('Could not open "' + filename + '".');
        return;
    }
    if (_currentObjectUrl) URL.revokeObjectURL(_currentObjectUrl);
    _currentObjectUrl = URL.createObjectURL(f);
    playVideo(_currentObjectUrl, filename, f.size);
    currentVideo = { name: filename, size: f.size };
    currentVideoBlob = null;
    // Load markers/loop/cut from localStorage
    loadVideoState(filename);
}

function loadVideoState(filename) {
    try {
        var saved = JSON.parse(localStorage.getItem('mirror-markers-' + filename));
        markers = (saved && typeof saved === 'object' && !Array.isArray(saved)) ? saved : {};
    } catch(e) { markers = {}; }
    try {
        var loopSaved = JSON.parse(localStorage.getItem('mirror-loop-' + filename));
        if (loopSaved && typeof loopSaved === 'object') {
            loopStartTime = loopSaved.start; loopEndTime = loopSaved.end;
            loopDelay = (typeof loopSaved.delay === 'number' && loopSaved.delay >= 0) ? loopSaved.delay : 0;
        } else { loopStartTime = null; loopEndTime = null; loopDelay = 0; }
    } catch(e) { loopStartTime = null; loopEndTime = null; loopDelay = 0; }
    isLoopPlaying = false;
    if (loopDelayInput) loopDelayInput.value = loopDelay;
    if (typeof clearLoopDelay === 'function') clearLoopDelay();
    updateLoopDisplay();
    updateLoopPlayBtn();
}

// Click handler for video list
videoList.addEventListener('click', async function(e) {
    var li = e.target.closest('li');
    if (!li) return;
    var name = li.getAttribute('data-name');
    if (name) {
        loadVideoFromLibrary(name);
    }
});

// Add Video button — copies chosen files into the browser's private storage
var addVideoBtn = document.getElementById('addVideoBtn');
var videoFileInput = document.getElementById('videoFileInput');
var uploadProgress = document.getElementById('uploadProgress');
addVideoBtn.addEventListener('click', function() { videoFileInput.click(); });
videoFileInput.addEventListener('change', async function() {
    var files = videoFileInput.files;
    if (!files.length) return;
    for (var i = 0; i < files.length; i++) {
        uploadProgress.style.display = 'inline';
        uploadProgress.textContent = 'Adding ' + files[i].name + '...';
        try {
            await saveLibraryVideo(files[i]);
        } catch(e) {
            uploadProgress.textContent = 'Could not add: ' + e.message;
            setTimeout(function() { uploadProgress.style.display = 'none'; }, 5000);
            return;
        }
    }
    uploadProgress.style.display = 'none';
    videoFileInput.value = '';
    renderLibrary();
});

// ============================================================
// Play Video
// ============================================================
function playVideo(src, name, size) {
    videoPlayer.style.opacity = '1';
    videoPlayer.style.pointerEvents = '';

    videoPlayer.src = src;
    playerLayout.classList.add('active');
    playerTitle.textContent = name;
    videoInfo.innerHTML = '';

    if (isMirrored) {
        videoWrap.classList.add('mirrored');
    } else {
        videoWrap.classList.remove('mirrored');
    }

    videoPlayer.load();
    renderKeybinds();
}

function formatFileSize(bytes) {
    if (!bytes) return 'Unknown';
    var mb = bytes / 1048576;
    return mb >= 1 ? mb.toFixed(1) + ' MB' : (bytes / 1024).toFixed(0) + ' KB';
}

function escapeHTML(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
