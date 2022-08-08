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

function showPubs(id) {
    console.log(id);
    if (id == 0) {
        document.getElementById('pubs').innerHTML = document.getElementById('pubs_selected').innerHTML;
        document.getElementById('select0').style = 'text-decoration:underline;color:#000000';
        document.getElementById('select1').style = '';
        // document.getElementById('select2').style = '';
    } else if (id == 1) {
        document.getElementById('pubs').innerHTML = document.getElementById('pubs_all_by_date').innerHTML;
        document.getElementById('select1').style = 'text-decoration:underline;color:#000000';
        document.getElementById('select0').style = '';
        // document.getElementById('select2').style = '';
    } else {
        document.getElementById('pubs').innerHTML = document.getElementById('pubs_by_topic').innerHTML;
        document.getElementById('select2').style = 'text-decoration:underline;color:#000000';
        document.getElementById('select0').style = '';
        // document.getElementById('select1').style = '';
    }
}