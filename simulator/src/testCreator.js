/**
    The contents of this file are used for the testbench creator view
    at /testbench
*/


window.onload = () => {
    const query = new URLSearchParams(window.location.search);
    if (query.has('data')) {
        $("#tb-creator-head").html("<b>Edit Test</b>")
        loadData(query.get('data'));
        return;
    }

    if (query.has('result')) {
        $("#tb-creator-head").html("<b>Test Result</b>")
        loadResult(query.get('result'));
        readOnlyUI();
        return;
    }

    addInput();
    addOutput();
    makeSortable();
}

var mode = "comb";
var groupIndex = 0;
var inputCount = 0;
var nextInputIndex = 0;
var outputCount = 0;
var nextOutputIndex = 0;
var cases = [0];

function dataReset() {
    groupIndex = -1;
    cases = [0];
}

/* Change UI mode between Combinational(comb) and Sequential(seq) */
function changeMode(m) {
    if(mode === m) return false;
    dataReset();
    mode = m;
    $(`#combSelect`).removeClass('tab-selected');
    $(`#seqSelect`).removeClass('tab-selected');
    $("#tb-new-group").css("visibility", m === "seq" ? "visible" : "hidden");
    $(`#${m}Select`).addClass('tab-selected');
    $("#dataGroup").empty();

    return true;
}

/* Adds case to a group */
function addCase(grp) {
    let current_group_table = $(`#data-table-${grp + 1}`);

    let s = `<tr><td class="tb-handle"><div onclick="deleteCase($(this))"class="fa fa-minus-square tb-minus"></div></td>\n`;
    for(let i = 0; i < inputCount + outputCount; i ++) s += '<td contenteditable="true">0</td>';
    s += '</tr>';
    current_group_table.append(s);
}

/* Deletes case from a group */
function deleteCase(element) {
    const row = element.parent().parent();
    const grp = Number(row.parent().attr('id').split('-').pop());

    row.remove();
}

/* Adds group with default name 'Group N' or name supplied in @param groupName */
/* Used without params by UI, used with params by loadData() */
function addGroup(groupName=`${mode === "comb"? "Group" : "Set"} ${groupIndex + 2}`) {
    $(".plus-button").removeClass("latest-button");
    groupIndex++;

    const s = 
    `
    <div id="data-group-${groupIndex + 1}" class="data-group">
        <h3 id="data-group-title-${groupIndex + 1}" contenteditable="true">${escapeHtml(groupName)}</h3>
        <h5 class="table-help-text">Click + to add tests to the ${mode === "comb"? "group" : "set"}</h5>
        <table style="width:100%" class="tb-table" id="data-table-${groupIndex + 1}">
        </table>
        <button class="lower-button plus-button latest-button" id="plus-${groupIndex + 1}" onclick="addCase(${groupIndex})" style="font-size: 25px;">+</button>
    </div>
    `;
    cases[groupIndex] = 0;
    $("#dataGroup").append(s);

    makeSortable();
}

/* Deletes a group */
function deleteGroup(element) {
    const groupDiv = element.parent();
    const grp = Number(groupDiv.attr('id').split('-').pop());
    groupDiv.remove();
}

/* Adds input with default value 0 or values supplied in @param inputData */
/* Used without params for UI, used with params by loadData() */
function addInput(label=`inp${nextInputIndex + 1}`, bitwidth=1, inputData=[]) {
    nextInputIndex++;
    inputCount++;
    // Change head table contents
    const s_head = `<th style="background-color: #aaf" id="tb-inp-label-${nextInputIndex}"><span contenteditable="true">${escapeHtml(label)}</span> <a onclick="deleteInput($(this));"><span class="fa fa-minus-square tb-minus"></span></a></th>`;
    const s_data = `<td contenteditable="true">${escapeHtml(bitwidth.toString())}</td>`;
    $("#testBenchTable").find("tr").eq(1).find("th").eq(inputCount - 1).after(s_head);
    $("#testBenchTable").find("tr").eq(2).find("td").eq(inputCount - 1).after(s_data);
    $("#tb-inputs-head").attr("colspan", inputCount);

    // Change data tables' contents
    $("#dataGroup").find("table").each(function(group_i) {
        $(this).find("tr").each(function(case_i) {
            let s = `<td contenteditable="true">${inputData.length ? escapeHtml(inputData[group_i][case_i]) : 0}</td>`;
            $(this).find("td").eq(inputCount - 1).after(s);
        });
    });


}

/* Adds output with default value 0 or values supplied in @param outputData */
/* Used without params for UI, used with params by loadData() */
function addOutput(label=`out${nextOutputIndex + 1}`, bitwidth=1, outputData=[]) {
    nextOutputIndex++;
    outputCount++;
    // Change head table contents
    const s_head = `<th style="background-color: #afa" id="tb-out-label-${nextOutputIndex}"><span contenteditable="true">${escapeHtml(label)}</span> <a onclick="deleteOutput($(this));"><span class="fa fa-minus-square tb-minus"></span></a></th>`
    const s_data = `<td contenteditable="true">${escapeHtml(bitwidth.toString())}</td>`;
    $("#testBenchTable").find("tr").eq(1).find("th").eq(inputCount + outputCount - 1).after(s_head);
    $("#testBenchTable").find("tr").eq(2).find("td").eq(inputCount + outputCount - 1).after(s_data);
    $("#tb-outputs-head").attr("colspan", outputCount);

    // Change data tables' contents

    $("#dataGroup").find("table").each(function(group_i) {
        $(this).find("tr").each(function(case_i) {
            let s = `<td contenteditable="true">${outputData.length ? escapeHtml(outputData[group_i][case_i]) : 0}</td>`;
            $(this).find("td").eq(inputCount + outputCount - 1).after(s);
        });
    });

}

/* Deletes input unless there's only one input */
function deleteInput(element) {
    if(inputCount === 1) return;
    const columnIndex = element.parent().eq(0).index();


    $('#testBenchTable tr, .data-group tr').slice(1).each(function() {
        $(this).find('td, th').eq(columnIndex).remove();
    });

    inputCount--;
    $("#tb-inputs-head").attr("colspan", inputCount);

}

/* Deletes output unless there's only one output */
function deleteOutput(element) {
    if(outputCount === 1) return;
    const columnIndex = element.parent().eq(0).index();

    $('#testBenchTable tr, .data-group tr').slice(1).each(function() {
        $(this).find('td, th').eq(columnIndex).remove();
    });

    outputCount--;
    $("#tb-outputs-head").attr("colspan", outputCount);
}

/* Returns input/output(keys) and their bitwidths(values) */
/* Called by getData() */
function getBitWidths() {
    let bitwidths = {};
    $("#testBenchTable").find("tr").eq(1).find("th").slice(1).each(function(index) {
        const inp = $(this).text();
        const bw =  $("#testBenchTable").find("tr").eq(2).find("td").slice(1).eq(index).html();
        bitwidths[inp] = Number(bw);
    });
    return bitwidths;
}

/* Returns data for all the groups for all inputs and outputs */
/* Called by parse() */
function getData() {

    const bitwidths = getBitWidths();
    let groups = []
    const groupCount = $('#dataGroup').children().length;
    for(let group_i = 0; group_i < groupCount; group_i++){
        let group = {};
        group.label = $(`#data-group-title-${group_i + 1}`).html();
        group.inputs = [];
        group.outputs = [];

        const group_table = $(`#data-table-${group_i + 1}`);
        group.n = group_table.find("tr").length;

        // Push all the inputs in the group
        for(let inp_i = 0; inp_i < inputCount; inp_i++){
            let label = Object.keys(bitwidths)[inp_i];
            let input = { label: label.slice(0, label.length - 1), bitWidth: bitwidths[label], values: [] };
            group_table.find("tr").each(function() {
                input.values.push($(this).find("td").slice(1).eq(inp_i).html());
            });

            group.inputs.push(input);
        }

        // Push all the outputs in the group
        for(let out_i = 0; out_i < outputCount; out_i++){
            const label = Object.keys(bitwidths)[inputCount + out_i];
            let output = { label: label.slice(0, label.length - 1), bitWidth: bitwidths[label], values: [] };
            group_table.find("tr").each(function() {
                output.values.push($(this).find("td").slice(1).eq(inputCount + out_i).html());
            });

            group.outputs.push(output);
        }

        groups.push(group);
    }

    return groups;
}

/* Parse UI table into Javascript Object */
function parse() {
    let data = {};
    const tableData = getData();
    data.type = mode;
    data.title = $('#test-title-label').text();
    data.groups = tableData;
    console.log(data);
    console.log(JSON.stringify(data));
    prompt("Ctrl + C to copy", JSON.stringify(data))
    return data;
}

/* Loads data from JSON string into the table */
function loadData(data) {
    data = JSON.parse(data);
    if(data.title) $('#test-title-label').text(data.title);
    changeMode(data.type);
    for (let group_i = 0; group_i < data.groups.length; group_i ++) {
        const group = data.groups[group_i];
        addGroup(group.label);
        for (let case_i = 0; case_i < group.inputs[0].values.length; case_i ++) {
            // console.log(case_i);
            addCase(group_i);
        }
    }

    // Add input values
    for (let input_i in data.groups[0].inputs) {
        const input = data.groups[0].inputs[input_i];
        const values = data.groups.map(group => { return group.inputs[input_i].values; });

        addInput(input.label, input.bitWidth, values);
    }

    // Add output values
    for (let output_i in data.groups[0].outputs) {
        const output = data.groups[0].outputs[output_i];
        const values = data.groups.map(group => { return group.outputs[output_i].values; });

        addOutput(output.label, output.bitWidth, values);
    }

}

function loadResult(data) {
    data = JSON.parse(data);
    if(data.title) $('#test-title-label').text(data.title);
    changeMode(data.type);
    for (let group_i = 0; group_i < data.groups.length; group_i ++) {
        const group = data.groups[group_i];
        addGroup(group.label);
        for (let case_i = 0; case_i < group.inputs[0].values.length; case_i ++) {
            // console.log(case_i);
            addCase(group_i);
        }
    }

    // Add input values
    for (let input_i in data.groups[0].inputs) {
        const input = data.groups[0].inputs[input_i];
        const values = data.groups.map(group => { return group.inputs[input_i].values; });

        addInput(input.label, input.bitWidth, values);
    }

    // Add output values
    for (let output_i in data.groups[0].outputs) {
        const output = data.groups[0].outputs[output_i];
        const values = data.groups.map(group => { return group.outputs[output_i].values; });
        const results = data.groups.map(group => { return group.outputs[output_i].results; });
        const tableResult = [];

        for (let group_i in values) {
            const res = [];
            for (let val_i in values[group_i]) {
                res.push(`${values[group_i][val_i]} - ${results[group_i][val_i]}`);
            }

            tableResult.push(res);
        }

        addOutput(output.label, output.bitWidth, tableResult);
    }
}

function readOnlyUI() {
    makeContentUneditable();
    makeUnsortable();
    $(".lower-button, .table-button, .tb-minus, .table-help-text").hide();
    $(".tablink").attr('disabled', 'disabled');
    $(".tablink").removeClass('tablink-no-override');
}

function makeContentUneditable() {
    $('body').find('td, th, span, h3, div').each(function() {
        $(this).attr('contenteditable', 'false');
    });
}

function makeSortable() {

    const helper = function(e, ui) {
        let helperE = ui.clone();
        helperE.children().each(function(child_i) {
            $(this).width(ui.children().eq(child_i).width());
        });

        return helperE;
    };

    const makePlaceholder = function(e, ui) {
        ui.placeholder.children().each(function() { $(this).css('border', '0px'); })
    }

    $(".data-group table").sortable({ 
        handle: '.tb-handle',
        helper: helper,
        start: makePlaceholder,
        placeholder: 'clone',
        connectWith: '.data-group table',
        scroll: false
    });
}

function makeUnsortable() {
    $(".data-group table").sortable({ disabled: true });
}

function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Making HTML called functions global

window.addGroup = addGroup;
window.deleteGroup = deleteGroup;
window.addCase = addCase;
window.deleteCase = deleteCase;
window.addInput = addInput;
window.deleteInput = deleteInput;
window.addOutput = addOutput;
window.deleteOutput = deleteOutput;
window.parse = parse;
window.changeMode = changeMode;