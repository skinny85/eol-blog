module.exports = latestPosts;

function latestPosts(files, k) {
    var ret = [];
    for (var i = 0; i < k; i++) {
        ret.push(undefined);
    }
    Object.keys(files).forEach(function (fileKey) {
        var file = files[fileKey];
        if (file.id) {
            insertPreservingOrder(ret, file);
        }
    });
    return ret.filter(function (elem) { return !!elem; });
}

function insertPreservingOrder(array, file) {
    var slot = findAvailableSlot(array, file);
    if (slot !== -1) {
        insertShiftingRight(array, file, slot);
    }
}

function findAvailableSlot(array, file) {
    return array.findIndex(function (elem) {
        return !elem || elem.id < file.id;
    });
}

function insertShiftingRight(array, elem, index) {
    var prev, current = elem;
    for (var i = index; i < array.length; i++) {
        prev = array[i];
        array[i] = current;
        current = prev;
    }
}
