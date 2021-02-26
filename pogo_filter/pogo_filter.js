function map(func) {
    var fn = func;
    function *submap(it) {
        for (let item of it)
            yield fn(item);
    }
    return submap;
}

function filter(func) {
    var fn = func;
    function* subfilter(it) {
        for (let item of it)
            if (fn(item))
                yield item;
    }
    return subfilter;
}

function reduce(func) {
    var fn = func;
    function subreduce(it) {
        var result
        let first = true;
        for (let item of it) {
            if (first) {
                result = item;
                first = false;
                continue;
            }
            result = fn(result, it);
        }
        return result;
    }
    return subreduce;
}

function join(sep) {
    var s = sep;
    function subjoin(it) {
        var result = ''
        let first = true;
        for (let item of it) {
            if (first)
                first = false;
            else
                result += s;
            result += item;
        }
        return result;
    }
    return subjoin;
}

function chain(it, fn, ...jobs) {
    if (!fn)
        return it;
    return chain(fn(it), ...jobs);
}

// Set.prototype.toString = function () {
    // var result = '{'
    // for (let [key, value] of this) {
        // result += key + ',';
    // }
    // result += '}'
    // return result;
// }

// Map.prototype.toString = function () {
    // var result = '{'
    // for (let [key, value] of this) {
        // result += key + '=>' + value + ',';
    // }
    // result += '}'
    // return result;
// }

var data;
var l10n;
var l10n_by_id;
var storage;
var groups;
var species;
var sections;
var filters;
var index_by_name;

function prepare() {
    groups = new Map();
    for (let i = 0; i < data.length; ++i) {
        if (!groups.has(data[i].name))
            groups.set(data[i].name, new Map());
        if (!groups.get(data[i].name).has(data[i].filter1))
            groups.get(data[i].name).set(data[i].filter1, new Map());
        if (!groups.get(data[i].name).get(data[i].filter1).get(data[i].filter2))
            groups.get(data[i].name).get(data[i].filter1).set(data[i].filter2, new Map());
        if (!groups.get(data[i].name).get(data[i].filter1).get(data[i].filter2).get(data[i].shiny ? "shiny" : ""))
            groups.get(data[i].name).get(data[i].filter1).get(data[i].filter2).set(data[i].shiny ? "shiny" : "", new Map());
        groups.get(data[i].name).get(data[i].filter1).get(data[i].filter2).get(data[i].shiny ? "shiny" : "").set("male", 0);
        groups.get(data[i].name).get(data[i].filter1).get(data[i].filter2).get(data[i].shiny ? "shiny" : "").set("female", 0);
    }
    sections = new Map();
    filters = new Map();
}

function image(i) {
    return `https://www.serebii.net/pokemongo/pokemon/${data[i].serebii_id}.png`;
    //return `https://archives.bulbagarden.net/media/upload/${data[i].bulbapedia_id}.png`;
    //return `https://github.com/ZeChrales/PogoAssets/blob/master/pokemon_icons/pokemon_icon_${data[i].pogoassets_id}.png?raw=true`;
}

function default_specy() {
    return {section: '', gender: 0};
}

function add_to_section(i, section) {
    if (!sections.has(section))
        sections.set(section, new Set());
    sections.get(section).add(i);
}

function remove_from_section(i, section) {
    if (!sections.has(section))
        return;
    sections.get(section).delete(i);
    if (sections.get(section).size === 0)
        sections.delete(section);
}

function save_all() {
    localStorage.setItem(location.pathname, JSON.stringify(storage));
}

function load_list() {
    //console.log(`loading ${$('#list select').val()}`);
    species = storage.lists[$('#list select').val()];
    
    //console.log(species);
    
    for (let i = 0; i < data.length; ++i) {
        let g = groups.get(data[i].name).get(data[i].filter1).get(data[i].filter2).get(data[i].shiny ? "shiny" : "");
        g.set("male", 0);
        g.set("female", 0);
    }
    sections.clear();
    filters.clear();

    let special = !!species['_special_'];
    $('#special').prop('checked', special);
    for (let i = 0; i < data.length; ++i) {
        let {section, gender} = species[data[i].pvpoke_id] || default_specy();
        $(`input[name=pokemon_${data[i].pvpoke_id}]:eq(${~gender})`).prop('checked', true);
        $(`input[name=pokemon_${data[i].pvpoke_id}] ~ u`).text(section);
        let g = groups.get(data[i].name).get(data[i].filter1).get(data[i].filter2).get(data[i].shiny ? "shiny" : "");
        g.set('male', g.get('male') + (gender >> 1 & 1));
        g.set('female', g.get('female') + (gender & 1));
        if (gender !== 0 && (special || !data[i].special))
            add_to_section(i, section)
        else
            remove_from_section(i, section);
        filters.set(data[i].name, update_filter(data[i].name));
    }
    
    generate();
    onfilter();
}

function load_all() {
    storage = JSON.parse(localStorage.getItem(location.pathname) || "{}");
    if (!storage.lists)
        storage.lists = {};
    if (!storage.language)
        storage.language = l10n[0].id;
    for (let name in storage.lists) {
        $('#list select').append($('<option></option>').prop('value', name).text(name));
    }
    $('#list select option:first-child').prop('selected', true);
    $(`#language option[value=${$.escapeSelector(storage.language)}]`).prop('selected', true);
    on_list_change();
}

function update_filter(pokemon) {
    var special = $('#special').prop('checked');
    let l10n = l10n_by_id[$('#language').val()].data;
    function uf(group) {
        if (group === 0)
            return [''];
        if (group > 0)
            return [];
        let group_it = group.entries();
        if (!special)
            group_it = filter(([key, value]) => key != "shiny")(group_it);
        let items = Array.from(group_it, ([key, value]) => [key, uf(value)]);
        if (items.length === 1)
            return items[0][1];
        if (items.map(([key, value]) => value.length === 1 && value[0] === '').reduce((x, y) => x && y))
            return ['']
        let result = []
        for (let [key, value] of items) {
            let filter
            if (key === '')
                filter = ',' + Array.from(group.keys()).filter(x => x).map(x => l10n.filters[x.toLowerCase()]).join(',');
            else
                filter = ',!' + l10n.filters[key.toLowerCase()];
            for (let item of value)
                result.push(filter + item);
        }
        return result;
    }
    let filters = uf(groups.get(pokemon));
    if (filters.length === 1 && filters[0] === '')
        return ''
    return filters.map(filter => '&!' + l10n.names[pokemon.toLowerCase()] + filter).join('')
}

function update(i) {
    let special = $('#special').prop('checked');
    if (!species[data[i].pvpoke_id])
        species[data[i].pvpoke_id] = default_specy();
    let {section, gender: old_gender} = species[data[i].pvpoke_id];
    let new_gender = +$('input[name=pokemon_' + data[i].pvpoke_id + ']:checked').val();
    let g = groups.get(data[i].name).get(data[i].filter1).get(data[i].filter2).get(data[i].shiny ? "shiny" : "");
    g.set('male', g.get('male') + (new_gender >> 1 & 1) - (old_gender >> 1 & 1));
    g.set('female', g.get('female') + (new_gender & 1) - (old_gender & 1));
    species[data[i].pvpoke_id].gender = new_gender;
    if (new_gender !== 0 && (special || !data[i].special))
        add_to_section(i, section)
    else
        remove_from_section(i, section);
    filters.set(data[i].name, update_filter(data[i].name));
}

function generate() {
    let special = $('#special').prop('checked');
    let l10n = l10n_by_id[$('#language').val()].data;
    let result = l10n.phrases.caption + '\n\n';
    result += chain([...sections.entries()].sort(), map(function ([key, value]) {
        return [key, chain(value.values(), map(function(i) {
            var pokemon_name = l10n.names[data[i].name.toLowerCase()];
            if (data[i].form)
                pokemon_name += ':(' + l10n.forms[data[i].form.toLowerCase()] + ')';
            if (data[i].shiny)
                pokemon_name += ':(' + l10n.forms['shiny'] + ')';
            if (species[data[i].pvpoke_id].gender == 2)
                pokemon_name += ':(' + l10n.forms['male'] + ')';
            if (species[data[i].pvpoke_id].gender == 1)
                pokemon_name += ':(' + l10n.forms['female'] + ')';
            return pokemon_name;
        }), join(', '))]
    }), filter(([key, value]) => value), 
    map(([key, value]) => '⮁' + key + ': ' + value + ';\n'),
    join(''));
    result += '\n' + l10n.phrases.caption2 + '\n';
    result += chain(filters.values(), join(''));
    if (!special)
        result += '&!' + l10n.filters['shiny'] + '&!' + l10n.filters['purified'];
    result += '&!' + l10n.filters['traded'] + '&!' + l10n.filters['perfect'] + ';\n\n' + l10n.phrases.postscript;
    $('textarea').val(result);
}

function onchange(i) {
    update(i);
    generate();
    save_all();
}

function on_special_change() {
    species['_special_'] = $('#special').prop('checked');
    for (let i = 0; i < data.length; ++i)
        update(i);
    onfilter();
    generate();
    save_all();
}

function onfilter() {
    let l10n = l10n_by_id[$('#language').val()].data;
    var re = new RegExp($('#filter').val(), 'i');
    let special = $('#special').prop('checked');
    for (let i = 0; i < data.length; ++i) {
        var mon = $('#' + data[i].pvpoke_id);
        if ((re.test(data[i].name) || re.test(l10n.names[data[i].name.toLowerCase()]) || re.test(data[i].dex)) && (!data[i].special || special))
            mon.show();
        else
            mon.hide();
    }
}

function on_list_change() {
    $('#list input[type=text]').val($('#list select').val()).css('color', 'black');
    if ($('#list select option').length === 0)
        on_list_new();
    load_list();
}   

function on_list_input() {
    var old_name = $('#list select').val();
    var name = $('#list input[type=text]').val();
    if (name == old_name)
        return;
    if ($('#list select option[value="' + $.escapeSelector(name) + '"]').length != 0) {
        $('#list input[type=text]').css('color', 'red');
        return;
    }
    storage.lists[name] = storage.lists[old_name];
    delete storage.lists[old_name];
    $('#list select option:selected').prop('value', name).text(name)
    $('#list input[type=text]').css('color', 'black');
    save_all();
}

function on_list_new() {
    for (var i = 1; ; ++i) {
        var name = "New filter #" + i;
        if ($('#list select option[value="' + $.escapeSelector(name) + '"]').length == 0)
            break;
    }
    $('#list select').append($('<option></option>').prop('value', name).text(name));
    $('#list select option:last-child').prop('selected', true);
    storage.lists[name] = {};
    save_all();
    on_list_change();
}

function on_list_delete() {
    var name = $('#list select').val();
    $('#list select option:selected').remove();
    delete storage.lists[name];
    save_all();
    on_list_change();
}
        
function on_textarea_focus() {
    $('textarea').select();
}

var toolbox_specy_id

function on_pokemon_context(e, i) {
    e.preventDefault();
    toolbox_specy_id = i;
    $('.toolbox .pokemon img').attr('src', image(i));
    $('#section select option').remove();
    var used = {'': true};
    var sections = [''];
    for (let i = 0; i < data.length; ++i) {
        let {section, gender} = species[data[i].pvpoke_id] || default_specy();
        if (used[section])
            continue;
        used[section] = true;
        sections.push(section);
    }
    sections.sort();
    for (let i = 0; i < sections.length; ++i)
        $('#section select').append(`<option value="${sections[i]}">${sections[i]}</option>`);
    let {section, gender} = species[data[i].pvpoke_id] || default_specy();
    $('#section input[type=text]').val(section);
    $('.toolbox').show();
}

function on_section_change() {
    $('#section input[type=text]').val($('#section select').val())
    $('#section select option:first-child').prop('selected', true);
    on_section_input();
}

function on_section_input() {
}

function on_toolbox_close(e) {
    var new_section = $('#section input[type=text]').val();
    if (!species[data[toolbox_specy_id].pvpoke_id])
        species[data[toolbox_specy_id].pvpoke_id] = default_specy();
    let {section: old_section, gender} = species[data[toolbox_specy_id].pvpoke_id];
    if (gender !== 0 && (special || !data[toolbox_specy_id].special)) {
        remove_from_section(toolbox_specy_id, old_section);
        add_to_section(toolbox_specy_id, new_section);
    }
    species[data[toolbox_specy_id].pvpoke_id].section = new_section;
    $(`input[name=pokemon_${data[toolbox_specy_id].pvpoke_id}] ~ u`).text(new_section);
    toolbox_specy_id = undefined;
    $('#section input[type=text]').val('');
    $('.toolbox').hide();
    generate();
    save_all();
}

function reset() {
    if (!confirm("Clear all data?"))
        return;
    localStorage.removeItem(location.pathname);
    document.location.reload();
}

function parse_local(text, l10n) {
    species = {};
    for (let m of text.matchAll(/^⮁([^:]*):((\s+([^,;]+)[,;])+?)$/gm)) {
        console.log(`Match "${m}"`);
        console.log(m[2]);
        for (let n of m[2].matchAll(/\s+([^,;]+)/g)) {
            console.log(`Item "${n[1]}"`);
            let b = n[1].match(/^(.*?)(?::\(([^)]*?)\))?(?::\(([^)]*?)\))?(?::\(([^)]*?)\))?$/);
            if (!b) {
                console.log(`Failed to match ${n[1]}`);
                return;
            }
            console.log(b);
            let name = l10n.original_names[b[1].toLowerCase()];
            if (!name) {
                console.log(`Failed to find the original name ${b[1]}`);
                return;
            }
            let gender = 3;
            let shiny = false;
            let forme = '';
            for (let i = 2; i < b.length; ++i) {
                if (!b[i])
                    continue;
                let form = l10n.original_forms[b[i].toLowerCase()];
                if (!form) {
                    console.log(`Failed to find the original form ${b[i]}`);
                    return;
                } else if (form == 'Shiny')
                    shiny = true;
                else if (form == 'Male')
                    gender = 2;
                else if (form == 'Female')
                    gender = 1;
                else
                    forme = form;
            }
            let index = index_by_name[`${name}#${forme}#${shiny}`];
            if (index === undefined) {
                console.log(`Unable to find "${name}#${forme}#${shiny}"`);
                return;
            }
            console.log(`Added specy ${data[index].pvpoke_id}: {secion: ${m[1]}, gender: ${gender}}`);
            species[data[index].pvpoke_id] = {section: m[1], gender: gender};
            if (data[index].special)
                species['_special_'] = true;
        }
    }
    return species;
}

function parse(e) {
    if (!confirm("Parse filter?"))
        return;
    var text = e.originalEvent.clipboardData.getData('text');
    e.preventDefault();
    let species;
    for (let i = 0; i < l10n.length; ++i) {
        console.log(`Trying ${l10n[i].name}`);
        species = parse_local(text, l10n[i].data);
        if (species)
            break;
    }
    if (!species) {
        alert('Failed to parse');
        return;
    }
    storage.lists[$('#list select').val()] = species;
    save_all();
    load_list();
}

function on_language_change() {
    storage.language = $('#language').val();
    for (let i = 0; i < data.length; ++i)
        update(i);
    generate();
    save_all();
}

$(document).ready(function() {
    var r = 0;
    function request_json(filename, callback) {
        ++r;
        $.getJSON(filename, function(data) {
            callback(data);
            console.log(`Loaded "${filename}"`);
            --r;
            if (r == 0)
                load_all();
        });
    }
    
    request_json("l10n/list.json", function(_l10n) {
        l10n = _l10n;
        l10n_by_id = {};
        for (let i = 0; i < l10n.length; ++i) {
            $('#language').append(`<option value=${l10n[i].id}>${l10n[i].name}</option>`);
            l10n_by_id[l10n[i].id] = l10n[i];
            request_json("l10n/" + l10n[i].filename, (i => function(data) {
                l10n[i].data = {};
                for (let section in data) {
                    let translations = {};
                    let originals = {};
                    l10n[i].data[section.toLowerCase()] = translations;
                    l10n[i].data['original_' + section.toLowerCase()] = originals;
                    for (let key in data[section]) {
                        translations[key.toLowerCase()] = data[section][key];
                        originals[data[section][key].toLowerCase()] = key;
                    }
                }
            })(i))
        }
    });
    request_json("pogo_data.json", function(_data) {
        data = _data;
        index_by_name = {}
        for (let i = 0; i < data.length; ++i) {
            if (i == 0 || data[i].region != data[i-1].region)
                $('div.content').append('<div class="region"><span>' + data[i].region + '</span><hr/></div>');
            $('div.content').append(`<span class="dioecious_container" title="${data[i].dex}. ${data[i].name}${(data[i].form ? ' (' + data[i].form + ')' : '')}${(data[i].shiny ? ' ✨' : '')}" id="${data[i].pvpoke_id}"><input type="radio" name="pokemon_${data[i].pvpoke_id}" value="3"><input type="radio" name="pokemon_${data[i].pvpoke_id}" value="2"><input type="radio" name="pokemon_${data[i].pvpoke_id}" value="1"><input type="radio" name="pokemon_${data[i].pvpoke_id}" value="0" checked><s></s><u></u><img src="${image(i)}"></span>`);
            $('input[name=pokemon_' + data[i].pvpoke_id + ']').change((i => (() => onchange(i)))(i));
            $(`#${data[i].pvpoke_id}`).bind('contextmenu', (i => (e => on_pokemon_context(e, i)))(i));
            index_by_name[`${data[i].name}#${data[i].form}#${data[i].shiny}`] = i;
        }
        prepare();
    });

    $('#special').bind('change', on_special_change);
    $('#filter').bind('input', onfilter);
    $('#list select').bind('change', on_list_change);
    $('#list input[type=text]').bind('input', on_list_input);
    $('#list input[type=button]:first-child').bind('click', on_list_new);
    $('#list input[type=button]:last-child').bind('click', on_list_delete);
    $('textarea').bind('focus', on_textarea_focus);
    $('textarea').bind('paste', parse);
    $('textarea').bind('input', generate);
    $('#language').bind('change', on_language_change);
    $('#section select').bind('change', on_section_change);
    $('#section input[type=text]').bind('input', on_section_input);
    $('.toolbox').bind('click', on_toolbox_close);
    $('.toolbox div div').bind('click', e => e.stopPropagation());
})
