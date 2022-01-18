function map(fn) {
    return function*(it) {
        for (let item of it)
            yield fn(item);
    };
}

function integrate() {
    return function*(it) {
        for (let item of it)
            yield* item;
    };
}

function filter(fn) {
    return function*(it) {
        for (let item of it)
            if (fn(item))
                yield item;
    };
}

function reduce(fn) {
    return function(it) {
        var result
        let first = true;
        for (let item of it) {
            if (first) {
                result = item;
                first = false;
                continue;
            }
            result = fn(result, item);
        }
        return result;
    }
}

function join(s) {
    return function(it) {
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
    };
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
        let grp = groups;
        if (!grp.has(data[i].name))
            grp.set(data[i].name, {value: false, sub: new Map()});
        grp = grp.get(data[i].name).sub;
        if (!grp.has(data[i].filter1))
            grp.set(data[i].filter1, {value: false, sub: new Map()});
        grp = grp.get(data[i].filter1).sub;
        if (!grp.has(data[i].filter2))
            grp.set(data[i].filter2, {value: false, sub: new Map()});
        grp = grp.get(data[i].filter2).sub;
        let shiny = data[i].shiny ? "shiny" : "";
        if (!grp.has(shiny))
            grp.set(shiny, {value: false, sub: new Map()});
        grp = grp.get(shiny).sub;
        grp.set("male", {value: 0});
        grp.set("female", {value: 0});
    }
    sections = new Map();
    filters = new Map();
    for (let [key, value] of groups) {
        filters.set(key, generate_filter(key));
    }
}

function zero_groups(grp) {
    for (let [key, value] of grp) {
        if (value.value && value.sub)
            zero_groups(value.sub);
        value.value = 0;
    }
}

function update_node(node, value, ...args) {
    if (args.length === 0) {
        node.value += value;
        return;
    }
    update_node(node.sub.get(value), ...args);
    node.value = false;
    for (let [key, value] of node.sub) {
        if (!value.value)
            continue;
        node.value = true;
        break;
    }
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
    
    sections.clear();
    zero_groups(groups);

    let l10n = l10n_by_id[$('#language').val()].data;

    let special = !!species['_special_'];
    let compact = !!species['_compact_'];
    $('#special').prop('checked', special);
    $('#compact').prop('checked', compact);
    for (let i = 0; i < data.length; ++i) {
        let {section, gender} = species[data[i].pvpoke_id] || default_specy();
        let container = $(`#${data[i].pvpoke_id}`);
        container.find(`> input[value=${gender}]`).prop('checked', true);
        container.find(`> u`).text(section);
        update_gender_selection(i, section, special, 0, gender);
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

function generate_filter(pokemon) {
    function gen_term(key, keys) {
        if (key !== "")
            return l10n => ',!' + l10n.filters[key];
        keys = Array.from(chain(keys, filter(x => x), map(x => x.toLowerCase())));
        return l10n => chain(keys, map(key => ',' + l10n.filters[key]), join(''));
    }
    
    function gen(node) {
        if (!node.sub)
            return function*(l10n, special) {
                if (!node.value)
                    yield "";
            };
        let items = Array.from(chain(node.sub.entries(), map(([key, value]) => [key.toLowerCase(), value]), map(([key, value]) => [key, gen_term(key, node.sub.keys()), gen(value)])));
        if (items.length === 1)
            return items[0][2];
        let shiny = node.sub.has("shiny");
        let index = items[0][0] === "" ? 0 : 1;
        return function*(l10n, special) {
            if (!node.value)
                yield "";
            else if (shiny && !special)
                yield* items[index][2](l10n, special);
            else {
                for (let [key, term_gen, sub_gen] of items) {
                    let term = term_gen(l10n);
                    for (let tail of sub_gen(l10n, special)) {
                        yield term + tail;
                    }
                }
            }
        };
    }
    
    let node = groups.get(pokemon);
    let filter_gen = gen(node);
    return (l10n, special) => chain(filter_gen(l10n, special), filter(x => x), map(filter => '&!' + l10n.names[pokemon.toLowerCase()] + filter));
}

// function update_filter(pokemon, special, l10n) {
    // function uf(group) {
        // if (group === 0)
            // return [''];
        // if (group > 0)
            // return [];
        // let group_it = group.entries();
        // if (!special)
            // group_it = filter(([key, value]) => key != "shiny")(group_it);
        // let items = Array.from(group_it, ([key, value]) => [key, uf(value)]);
        // if (items.length === 1)
            // return items[0][1];
        // if (items.map(([key, value]) => value.length === 1 && value[0] === '').reduce((x, y) => x && y))
            // return ['']
        // let result = []
        // for (let [key, value] of items) {
            // let filter
            // if (key === '')
                // filter = ',' + Array.from(group.keys()).filter(x => x).map(x => l10n.filters[x.toLowerCase()]).join(',');
            // else
                // filter = ',!' + l10n.filters[key.toLowerCase()];
            // for (let item of value)
                // result.push(filter + item);
        // }
        // return result;
    // }
    // let filters = uf(groups.get(pokemon));
    // if (filters.length === 1 && filters[0] === '')
        // return ''
    // return filters.map(filter => '&!' + l10n.names[pokemon.toLowerCase()] + filter).join('')
// }

function update_gender_selection(i, section, special, old_gender, new_gender) {
    let male = (new_gender >> 1 & 1) - (old_gender >> 1 & 1);
    let female = (new_gender & 1) - (old_gender & 1);
    if (male !== 0)
        update_node(groups.get(data[i].name), data[i].filter1, data[i].filter2, data[i].shiny ? "shiny" : "", "male", male);
    if (female !== 0)
        update_node(groups.get(data[i].name), data[i].filter1, data[i].filter2, data[i].shiny ? "shiny" : "", "female", female);
    if (new_gender !== 0 && (special || !data[i].special))
        add_to_section(i, section)
    else
        remove_from_section(i, section);
}

function update(i) {
    let special = $('#special').prop('checked');
    let {section, gender: old_gender} = species[data[i].pvpoke_id] || default_specy();
    let new_gender = +$(`#${data[i].pvpoke_id} > input:checked`).val();
    update_gender_selection(i, section, special, old_gender, new_gender);
    if (old_gender !== new_gender) {
        if (!species[data[i].pvpoke_id])
            species[data[i].pvpoke_id] = default_specy();
        species[data[i].pvpoke_id].gender = new_gender;
    }
}

function generate() {
    let compact = $('#compact').prop('checked');
    let special = $('#special').prop('checked');
    let l10n = l10n_by_id[$('#language').val()].data;
    let result;
    if (compact)
        result = generate_compact(l10n, special);
    else
        result = generate_full(l10n, special);
    $('textarea').val(result);
}

function generate_full(l10n, special) {
    let result = chain([...sections.keys()].sort(), map(key => [key, sections.get(key)]), map(function ([key, value]) {
        return [key, chain(value.values(), map(function(i) {
            var pokemon_name = l10n.names[data[i].name.toLowerCase()];
            if (data[i].origin)
                pokemon_name += ':(' + l10n.forms[data[i].origin.toLowerCase()] + ')';
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
    map(([key, value]) => '§' + key + ': ' + value + ';\n'),
    join(''));
    if (!result)
        return '';
    result = l10n.phrases.caption + '\n\n' + result;
    result += '\n' + l10n.phrases.caption2 + '\n';
    result += chain(filters.entries(), filter(([key, value]) => groups.get(key).value), map(([key, fn]) => fn(l10n, special)), integrate(), join(''));
    if (!special)
        result += '&!' + l10n.filters['shiny'] + '&!' + l10n.filters['purified'];
    result += '&!' + l10n.filters['shadow'] + '&!' + l10n.filters['traded'] + '&!4*;\n\n' + l10n.phrases.postscript;
    return result;
}

function generate_compact(l10n, special) {
    let result = '';
    let first, last;
    for (let i = 0; i < data.length; ++i) {
        let {section, gender} = species[data[i].pvpoke_id] || default_specy();
        if (gender === 0)
            continue;
        if (last && last+1 >= data[i].dex)
            last = +data[i].dex;
        else {
            if (first) {
                if (first < last)
                    result += `${first}-${last},`;
                else
                    result += `${first},`;
            }
            first = last = +data[i].dex;
        }
    }
    if (!first)
        return '';
    if (first < last)
        result += `${first}-${last}`;
    else
        result += `${first}`;

    function footer(l10n, pecial) {
        let result = chain(filters.entries(), filter(([key, value]) => groups.get(key).value), map(([key, fn]) => fn(l10n, special)), integrate(), join(''));
        if (!special)
            result += '&!' + l10n.filters['shiny'] + '&!' + l10n.filters['purified'];
        result += '&!' + l10n.filters['shadow'] + '&!' + l10n.filters['traded'];
        return result;
    }
    result += footer(l10n, special);
    let l10n_en = l10n_by_id['en'].data;
    if (l10n !== l10n_en)
        result += footer(l10n_en, special);
    result += '&!4*;' + l10n.phrases.postscript;
    return result;
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

function on_compact_change() {
    species['_compact_'] = $('#compact').prop('checked');
    generate();
    save_all();
}

function parse_filter(s) {
    let i = 0;

    function skip_white() {
        while (i < s.length && ' \r\n\t'.indexOf(s[i]) != -1)
            ++i;
    }

    function parse_and() {
        let result = parse_or();
        skip_white();
        while (i < s.length && s[i] === '&') {
            ++i;
            result = {op: "and", arg: [result, parse_or()]};
        }
        return result;
    }
    
    function parse_or() {
        let result = parse_unary();
        skip_white();
        while (i < s.length && ',;:'.indexOf(s[i]) !== -1) {
            ++i;
            result = {op: "or", arg: [result, parse_unary()]};
        }
        return result;
    }
    
    function parse_unary() {
        skip_white();
        if (i < s.length && s[i] === '!') {
            ++i;
            return {op: "not", arg: parse_unary()};
        } else if (i < s.length && s[i] === '+') {
            ++i;
            return {op: "family", arg: parse_unary()};
        } else if (i < s.length && s[i] === '§') {
            let j = i;
            ++i;
            let res = parse_list();
            if (res)
                return res;
            i = j;
        }
        return parse_simple();
    }

    function parse_simple() {
        skip_white();
        let j = i;
        while (i < s.length && '&,;:'.indexOf(s[i]) === -1) {
            ++i;
        }
        let str = s.substring(j, i).trim().toLowerCase();
        return {op: "keyword", arg: str};
    }
    
    function parse_list() {
        let j = i;
        while (i < s.length && ':'.indexOf(s[i]) === -1) {
            ++i;
        }
        if (i >= s.length)
            return;
        let section = s.substring(j, i).trim() || true;
        ++i; // :
        let result = parse_item();
        if (!result)
            return;
        while(true) {
            skip_white();
            if (i >= s.length)
                return;
            if (s[i] === ';')
                break;
            if (s[i] !== ',')
                return;
            ++i;
            let op2 = parse_item();
            if (!op2)
                return;
            result = {op: "or", arg: [result, op2]};
        }
        return {op: "and", arg: [result, {op: "section", arg: section}]};
    }
    
    function parse_item() {
        skip_white();
        let j = i;
        while (i < s.length && ',;'.indexOf(s[i]) === -1 && (s[i] !== ':' || i+1 >= s.length || s[i+1] !== '(')) {
            ++i;
        }
        if (i >= s.length)
            return;
        let name = s.substring(j, i).trim().toLowerCase();
        let result = {op: "specy", arg: name};
        while (i < s.length && ',;'.indexOf(s[i]) === -1) {
            let f = parse_form();
            if (!f)
                return;
            result = {op: "and", arg: [result, f]};
        }
        return result;
    }
    
    function parse_form() {
        if (s[i] !== ':')
            return;
        ++i; // :
        if (s[i] !== '(')
            return;
        ++i; // (
        let j = i;
        while (i < s.length && s[i] !== ')') {
            ++i;
        }
        if (i >= s.length)
            return;
        let form = s.substring(j, i).trim().toLowerCase();
        ++i; // )
        return {op: "form", arg: form};
    }
    
    let r = parse_and();
    if (i != s.length)
        return;
    return r;
}

function make_appraiser(tree, l10n) {
    let undefined_re = RegExp(`^(?:${l10n.filters["mythical"]}|${l10n.filters["legendary"]}|${l10n.filters["shiny"]}|${l10n.filters['genderunknown']}|${l10n.filters['female']}|${l10n.filters['male']}|${l10n.filters["costume"]}|${l10n.filters["eggsonly"]}|${l10n.filters["item"]}|${l10n.filters["megaevolve"]}|${l10n.filters["evolve"]}|${l10n.filters["tradeevolve"]}|${l10n.filters["evolvenew"]}|${l10n.filters['lucky']}|${l10n.filters['shadow']}|${l10n.filters['purified']}|${l10n.filters['defender']}|${l10n.filters['hp']}\\s*\\d*-?\\d*|${l10n.filters['cp']}\\s*\\d*-?\\d*|${l10n.filters['year']}\\s*\\d*-?\\d*|${l10n.filters['age']}\\s*\\d*-?\\d*|${l10n.filters['distance']}\\s*\\d*-?\\d*|${l10n.filters['buddy']}\\s*\\d*-?\\d*|${l10n.filters['traded']}|${l10n.filters['hatched']}|${l10n.filters['research']}|${l10n.filters['raid']}|${l10n.filters['remoteraid']}|${l10n.filters['exraid']}|${l10n.filters['megaraid']}|${l10n.filters['rocket']}|${l10n.filters['gbl']}|${l10n.filters['snapshot']}|${l10n.filters['candyxl']})$`, "i");

    function appraiser(node) {
        switch (node.op) {
        case "and":
        case "or": {
            let op1 = appraiser(node.arg[0]);
            let op2 = appraiser(node.arg[1]);
            return record => op1(record) + op2(record);
        }
        case "not": {
            let op = appraiser(node.arg);
            return record => op(record);
        }
        case "family": {
            let op = appraiser(node.arg);
            return function(record) {
                let res = 0;
                for (let member of record.family)
                    res += op(member);
                return res;
            };
        }
        case "keyword": {
            if (!node.arg)
                return record => 0;
            if (node.arg.search(undefined_re) != -1)
                return record => 1;
            return record => +(l10n.names[record.name.toLowerCase()].toLowerCase().startsWith(node.arg) ||
                               l10n.filters[record.type1.toLowerCase()].toLowerCase() === node.arg ||
                               record.type2 !== "" && l10n.filters[record.type2.toLowerCase()].toLowerCase() === node.arg ||
                               l10n.filters[record.origin_region.toLowerCase()].toLowerCase() === node.arg);
        }
        case "section":
            return record => 0;
        case "specy":
            return record => +(l10n.names[record.name.toLowerCase()].toLowerCase() === node.arg);
        case "form":
            if (l10n.forms['male'].toLowerCase() === node.arg)
                return record => 1;
            if (l10n.forms['female'].toLowerCase() === node.arg)
                return record => 1;
            if (l10n.forms['shiny'].toLowerCase() === node.arg)
                return record => 1;
            return record => +(record.form !== "" && l10n.forms[record.form.toLowerCase()].toLowerCase() === node.arg || 
                               record.origin !== "" && l10n.forms[record.origin.toLowerCase()].toLowerCase() === node.arg);
        }
    }
    if (!tree)
        return record => 0;
    return appraiser(tree);
}

function make_checker(tree, l10n) {
    let none = {}
    let unclear = {}
    
    function or(op1, op2) {
        return function(record) {
            let x = op1(record);
            if (x && x !== none && x !== unclear)
                return x;
            let y = op2(record);
            if (x === none)
                return y;
            if (y === none)
                return x;
            if (y && y !== unclear)
                return y;
            if (x === unclear || y === unclear)
                return unclear;
            return y;
        }; 
    }

    function and(op1, op2) {
        return function(record) { 
            let x = op1(record);
            if (!x)
                return x;
            let y = op2(record);
            if (x === none)
                return y;
            if (y === none)
                return x;
            if (!y)
                return y;
            if (typeof(y) === "string")
                return y;
            if (typeof(x) === "string")
                return x;
            if (x === unclear || y === unclear)
                return unclear;
            return y;
        };
    }

    function not(op) {
        return function(record) {
            let x = op(record); 
            if (x === none || x === unclear)
                return x;
            return !x;
        };
    }
    
    function family(op) {
        return function(record) {
            let res = none;
            for (let member of record.family) {
                let x = op(member);
                if (x === none)
                    continue;
                if (x && x !== unclear)
                    return x;
                if (res !== unclear)
                    res = x;
            }
            return res;
        };
    }

    let undefined_re = RegExp(`^(?:@[\\w -]+|\\d\\*|${l10n.filters["mythical"]}|${l10n.filters["legendary"]}|${l10n.filters["shiny"]}|${l10n.filters['genderunknown']}|${l10n.filters['female']}|${l10n.filters['male']}|${l10n.filters["costume"]}|${l10n.filters["eggsonly"]}|${l10n.filters["item"]}|${l10n.filters["megaevolve"]}|${l10n.filters["evolve"]}|${l10n.filters["tradeevolve"]}|${l10n.filters["evolvenew"]}|${l10n.filters['lucky']}|${l10n.filters['shadow']}|${l10n.filters['purified']}|${l10n.filters['defender']}|${l10n.filters['hp']}\\s*\\d*-?\\d*|${l10n.filters['cp']}\\s*\\d*-?\\d*|${l10n.filters['year']}\\s*\\d*-?\\d*|${l10n.filters['age']}\\s*\\d*-?\\d*|${l10n.filters['distance']}\\s*\\d*-?\\d*|${l10n.filters['buddy']}\\s*\\d*-?\\d*|${l10n.filters['traded']}|${l10n.filters['hatched']}|${l10n.filters['research']}|${l10n.filters['raid']}|${l10n.filters['remoteraid']}|${l10n.filters['exraid']}|${l10n.filters['megaraid']}|${l10n.filters['rocket']}|${l10n.filters['gbl']}|${l10n.filters['snapshot']}|${l10n.filters['candyxl']})$`, "i");
    let dex_re = /^(?:(\d+)|(\d*)-(\d*))$/;
    let evolve_re = RegExp(`^(?:${l10n.filters["evolve"]}|${l10n.filters["tradeevolve"]}|${l10n.filters["evolvenew"]})$`, "i");
    let megaevolve_re = RegExp(`^${l10n.filters["megaevolve"]}$`, "i");
    let item_re = RegExp(`^${l10n.filters["item"]}$`, "i");
    let eggsonly_re = RegExp(`^${l10n.filters["eggsonly"]}$`, "i");
    let costume_re = RegExp(`^${l10n.filters["costume"]}$`, "i");
    let male_re = RegExp(`^${l10n.filters['male']}$`, "i");
    let female_re = RegExp(`^${l10n.filters['female']}$`, "i");
    let genderunknown_re = RegExp(`^${l10n.filters['genderunknown']}$`, "i");
    let shiny_re = RegExp(`^${l10n.filters["shiny"]}$`, "i");
    let legendary_re = RegExp(`^${l10n.filters["legendary"]}$`, "i");
    let mythical_re = RegExp(`^${l10n.filters["mythical"]}$`, "i");
    
    function keyword(str) {
        if (str === "")
            return record => none;
        let dex = str.match(dex_re);
        if (dex) {
            let left, right;
            if (dex[1])
                right = left = +dex[1];
            if (dex[2])
                left = +dex[2];
            if (dex[3])
                right = +dex[3];
            return record => (!left || left <= +record.dex) && (!right || +record.dex <= right);
        }
        if (str.search(evolve_re) != -1)
            return record => record.evolve;
        if (str.search(megaevolve_re) != -1)
            return record => record.megaevolve;
        if (str.search(item_re) != -1)
            return record => record.item;
        if (str.search(eggsonly_re) != -1)
            return record => record.eggsonly;
        // if (str.search(costume_re) != -1)
            // return record => record.costume;
        if (str.search(male_re) != -1)
            return record => record.male && (!record.female || unclear);
        if (str.search(female_re) != -1)
            return record => record.female && (!record.male || unclear);
        if (str.search(genderunknown_re) != -1)
            return record => !record.male && !record.female;
        if (str.search(shiny_re) != -1)
            return record => record.shiny;
        if (str.search(legendary_re) != -1)
            return record => record.legendary;
        if (str.search(mythical_re) != -1)
            return record => record.mythical;
        if (str.search(undefined_re) != -1)
            return record => unclear;
        return record => l10n.names[record.name.toLowerCase()].toLowerCase().startsWith(str) ||
                         l10n.filters[record.type1.toLowerCase()].toLowerCase() === str ||
                         record.type2 !== "" && l10n.filters[record.type2.toLowerCase()].toLowerCase() === str ||
                         l10n.filters[record.origin_region.toLowerCase()].toLowerCase() === str;
    }
    
    function checker(node) {
        switch (node.op) {
        case "and":
            return and(checker(node.arg[0]), checker(node.arg[1]));
        case "or":
            return or(checker(node.arg[0]), checker(node.arg[1]));
        case "not":
            return not(checker(node.arg));
        case "family":
            return family(checker(node.arg));
        case "keyword":
            return keyword(node.arg);
        case "section":
            return record => node.arg;
        case "specy":
            return record => l10n.names[record.name.toLowerCase()].toLowerCase() === node.arg;
        case "form":
            if (l10n.forms['male'].toLowerCase() === node.arg)
                return record => record.male && (!record.female || unclear);
            if (l10n.forms['female'].toLowerCase() === node.arg)
                return record => record.female && (!record.male || unclear);
            if (l10n.forms['shiny'].toLowerCase() === node.arg)
                return record => record.shiny;
            return record => record.form !== "" && l10n.forms[record.form.toLowerCase()].toLowerCase() === node.arg || 
                             record.origin !== "" && l10n.forms[record.origin.toLowerCase()].toLowerCase() === node.arg;
        }
    }
    if (!tree)
        return record => false;
    return checker(tree);
}

function onfilter() {
    let l10n = l10n_by_id[$('#language').val()].data;
    let check = make_checker(parse_filter($('#filter').val()), l10n);
    let special = $('#special').prop('checked');
    for (let i = 0; i < data.length; ++i) {
        var mon = $('#' + data[i].pvpoke_id);
        if (check(data[i]) && (!data[i].special || special))
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
    $(`#${data[toolbox_specy_id].pvpoke_id} > u`).text(new_section);
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

function parse(e) {
    if (!confirm("Parse filter?"))
        return;
    var text = e.originalEvent.clipboardData.getData('text');
    e.preventDefault();
    let tree = parse_filter(text);
    if (!tree) {
        alert('Failed to parse');
        return;
    }
    let best_l10n;
    let best_appraisal = 0
    for (let i = 0; i < l10n.length; ++i) {
        // console.log(`Trying ${l10n[i].name}`);
        let appraiser = make_appraiser(tree, l10n[i].data);

        let appraisal = 0;
        for (let i = 0; i < data.length; ++i) {
            let male = data[i].male;
            let female = data[i].female;
            data[i].male = true;
            data[i].female = false;
            appraisal += appraiser(data[i]);
            data[i].male = false;
            data[i].female = true;
            appraisal += appraiser(data[i]);
            data[i].male = male;
            data[i].female = female;
        }
        
        // console.log(`${l10n[i].name} gaines ${appraisal} points.`);
        if (best_appraisal < appraisal) {
            best_l10n = l10n[i];
            best_appraisal = appraisal;
        }
    }
    // console.log(`The best l10n is ${best_l10n.name}`);
    
    let checker = make_checker(tree, best_l10n.data);
    
    let species = {};
    for (let i = 0; i < data.length; ++i) {
        let male = data[i].male;
        let female = data[i].female;
        let gender = 0;
        let section = "";
        data[i].male = true;
        data[i].female = false;
        let r = checker(data[i]);
        if (r) {
            gender += 2;
            if (typeof(r) === "string")
                section = r;
        }
        data[i].male = false;
        data[i].female = true;
        r = checker(data[i]);
        if (r) {
            gender += 1;
            if (typeof(r) === "string")
                section = r;
        }
        data[i].male = male;
        data[i].female = female;
        if (!gender)
            continue;
        species[data[i].pvpoke_id] = {section: section, gender: gender};
        if (data[i].special)
            species['_special_'] = true;
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
        index_by_name = {};
        var family = {};
        var content = $('div.content');
        for (let i = 0; i < data.length; ++i) {
            if (i == 0 || data[i].region != data[i-1].region)
                content.append('<div class="region"><span>' + data[i].region + '</span><hr/></div>');
            content.append(`<span class="dioecious_container" title="${data[i].dex}. ${data[i].name}${(data[i].origin ? ' (' + data[i].origin + ')' : '')}${(data[i].form ? ' (' + data[i].form + ')' : '')}${(data[i].shiny ? ' ✨' : '')}" id="${data[i].pvpoke_id}"><input type="radio" name="${data[i].pvpoke_id}" value="3"><input type="radio" name="${data[i].pvpoke_id}" value="2"><input type="radio" name="${data[i].pvpoke_id}" value="1"><input type="radio" name="${data[i].pvpoke_id}" value="0" checked><s></s><u></u><img src="${image(i)}"></span>`);
            $(`#${data[i].pvpoke_id} > input`).change(() => onchange(i));
            $(`#${data[i].pvpoke_id}`).bind('contextmenu', e => on_pokemon_context(e, i));
            index_by_name[`${data[i].name}#${data[i].origin}${data[i].form}#${data[i].shiny}`] = i;
            if (family[data[i].family] === undefined)
                family[data[i].family] = [];
            family[data[i].family].push(data[i]);
            data[i].family = family[data[i].family];
        }
        prepare();
    });

    $('#special').bind('change', on_special_change);
    $('#compact').bind('change', on_compact_change);
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
