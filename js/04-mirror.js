// ============================================================
// Mirror
// ============================================================
function updateMirrorBtn() {
    if (isMirrored) {
        mirrorBtn.classList.add('mirrored-active');
        mirrorBtn.innerHTML = '&#x1f504; Mirrored';
    } else {
        mirrorBtn.classList.remove('mirrored-active');
        mirrorBtn.innerHTML = '&#x1f504; Original';
    }
}
mirrorBtn.addEventListener('click', function() {
    isMirrored = !isMirrored;
    if (isMirrored) { videoWrap.classList.add('mirrored'); }
    else { videoWrap.classList.remove('mirrored'); }
    updateMirrorBtn();
});
updateMirrorBtn();

