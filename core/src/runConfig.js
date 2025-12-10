"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mergeInputs = mergeInputs;
exports.mergeEnv = mergeEnv;
exports.selectFromVariables = selectFromVariables;
exports.resolvePresetEnv = resolvePresetEnv;
function mergeInputs(params) {
    const { defaultInputs = {}, exampleInputs = {}, manualInputs = {} } = params;
    return { ...defaultInputs, ...exampleInputs, ...manualInputs };
}
function mergeEnv(params) {
    const { baseEnv = {}, envvar = {}, presetEnv = {}, manualEnvvars = {} } = params;
    return { ...baseEnv, ...envvar, ...presetEnv, ...manualEnvvars };
}
function selectFromVariables(variables, key, choiceOrValue) {
    const def = variables?.[key];
    if (def && typeof def === 'object' && !Array.isArray(def)) {
        if (Object.prototype.hasOwnProperty.call(def, choiceOrValue)) {
            return def[choiceOrValue];
        }
        return choiceOrValue;
    }
    if (Array.isArray(def)) {
        return choiceOrValue;
    }
    return choiceOrValue;
}
function resolvePresetEnv(doc, presetName) {
    const out = {};
    if (!presetName) {
        return out;
    }
    const presets = doc.presets || {};
    const variables = doc.variables || {};
    let mapping;
    if (presets.runner && presets.runner[presetName]) {
        mapping = presets.runner[presetName];
    }
    else if (presetName.includes('.')) {
        const [group, name] = presetName.split('.', 2);
        if (presets[group] && presets[group][name]) {
            mapping = presets[group][name];
        }
    }
    if (!mapping) {
        return out;
    }
    for (const [k, choice] of Object.entries(mapping)) {
        out[k] = selectFromVariables(variables, k, choice);
    }
    return out;
}
//# sourceMappingURL=runConfig.js.map