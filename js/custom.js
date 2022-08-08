function copy(dest, source) {
    if(dest.source == source) {
        dest.innerHTML = "";
        dest.source = null;
    } else {
        dest.innerHTML = source.innerHTML;
        dest.source = source;
    }
    dest.blur();
}