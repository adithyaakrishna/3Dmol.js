//auto-initialization
import { GLViewer, createViewer, ViewerSpec } from "./GLViewer";
import { SurfaceType } from "./ProteinSurface4";
import { get, getbin, makeFunction, specStringToObject } from "./utilities";
import { CC } from "./colors";

export let autoinit = false;
export let processing_autoinit = false;

export const viewers: Record<string | number, GLViewer> = {};

type DatasetType = {
    [key: string]: string;
};

interface UIManager {
    createSelectionAndStyle: (select: any, style: any) => void;
    setModelTitle: (modelName: string) => void;
    loadSurface: (type: string, sel: any, sty: any, surfid: any) => void;
    initiateUI: () => void;
}

const handleDataUri = async (
    glviewer: GLViewer,
    datauri: string[],
    datatypes: string[],
    options: any,
    viewerdiv: HTMLElement,
    UI: UIManager | null,
    applyStyles: (glviewer: GLViewer, UI: UIManager | null) => void,
    callback?: (glviewer: GLViewer) => void
) => {
    for (let i = 0; i < datauri.length; i++) {
        const uri = datauri[i];
        const type = (viewerdiv.dataset as DatasetType).type || (viewerdiv.dataset as DatasetType).datatype || datatypes[i];
        const moldata = type?.endsWith('gz') ? await getbin(uri) : await get(uri);
        
        glviewer.addModel(moldata, type, options);
        
        if (UI) {
            const modelName = (viewerdiv.dataset as DatasetType)[datatypes[i]];
            UI.setModelTitle(modelName);
        }
    }

    applyStyles(glviewer, UI);

    if ((viewerdiv.dataset as DatasetType).callback) {
        const runres = makeFunction((viewerdiv.dataset as DatasetType).callback);
        runres(glviewer);
    }

    processing_autoinit = false;
    callback?.(glviewer);
};

export const autoload = (viewer?: GLViewer, callback?: (glviewer: GLViewer) => void): void => {
    if (document.querySelector(".viewer_3Dmoljs") !== null) {
        autoinit = true;
    }

    if (!autoinit) return;

    processing_autoinit = true;
    let nviewers = 0;

    document.querySelectorAll<HTMLElement>(".viewer_3Dmoljs").forEach((viewerdiv) => {
        if (viewerdiv.style.position === 'static') {
            viewerdiv.style.position = 'relative';
        }

        const dataset = viewerdiv.dataset as DatasetType;
        const datauri: string[] = [];
        const datatypes: string[] = [];

        // Process data sources
        if (dataset.pdb) {
            datauri.push(`https://files.rcsb.org/view/${dataset.pdb}.pdb`);
            datatypes.push("pdb");
        } else if (dataset.cid) {
            datatypes.push("sdf");
            datauri.push(`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${dataset.cid}/SDF?record_type=3d`);
        } else if (dataset.href || dataset.url) {
            const uri = dataset.href || dataset.url;
            datauri.push(uri);
            let type = uri.substring(uri.lastIndexOf('.') + 1);
            if (type === 'gz') {
                const pos = uri.substring(0, uri.lastIndexOf('.')).lastIndexOf('.');
                type = uri.substring(pos + 1);
            }
            datatypes.push(type);

            const molName = uri.substring(uri.lastIndexOf('/') + 1, uri.lastIndexOf('.')) || uri.substring(uri.lastIndexOf('/') + 1);
            dataset[datatypes[datatypes.length - 1]] = molName;
        }

        // Process additional data sources
        Object.entries(dataset).forEach(([key, value]) => {
            if (key.startsWith("pdb") && key !== "pdb") {
                datauri.push(`https://files.rcsb.org/view/${value}.pdb`);
                datatypes.push('pdb');
            } else if (key.startsWith("href") && key !== "href") {
                datauri.push(value);
                datatypes.push(value.substring(value.lastIndexOf('.') + 1));
            } else if (key.startsWith("cid") && key !== "cid") {
                datauri.push(`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${value}/SDF?record_type=3d`);
                datatypes.push('sdf');
            }
        });

        const options = dataset.options ? specStringToObject(dataset.options) : {};
        const bgcolor = CC.color(dataset.backgroundcolor);
        const bgalpha = dataset.backgroundalpha ? parseFloat(dataset.backgroundalpha) : 1.0;
        const style = dataset.style ? specStringToObject(dataset.style) : { line: {} };
        const select = dataset.select ? specStringToObject(dataset.select) : {};

        const selectstylelist: [any, any][] = [];
        const surfaces: [any, any][] = [];
        const labels: [any, any][] = [];
        const zoomto = dataset.zoomto ? specStringToObject(dataset.zoomto) : {};
        const spin = dataset.spin ? specStringToObject(dataset.spin) : null;

        // Process style, surface, and label data
        Object.entries(dataset).forEach(([key, value]) => {
            const styleMatch = key.match(/style(.+)/);
            const surfMatch = key.match(/surface(.*)/);
            const reslabMatch = key.match(/labelres(.*)/);

            if (styleMatch) {
                const selName = `select${styleMatch[1]}`;
                selectstylelist.push([specStringToObject(dataset[selName]), specStringToObject(value)]);
            } else if (surfMatch) {
                const selName = `select${surfMatch[1]}`;
                surfaces.push([specStringToObject(dataset[selName]), specStringToObject(value)]);
            } else if (reslabMatch) {
                const selName = `select${reslabMatch[1]}`;
                labels.push([specStringToObject(dataset[selName]), specStringToObject(value)]);
            }
        });

        const applyStyles = (glviewer: GLViewer, UI: UIManager | null) => {
            glviewer.setStyle(select, style);

            if (UI) {
                UI.createSelectionAndStyle(select, style);
            }

            selectstylelist.forEach(([sel, sty]) => {
                glviewer.setStyle(sel || {}, sty || { "line": {} });
                if (UI) {
                    UI.createSelectionAndStyle(sel, sty);
                }
            });

            surfaces.forEach(([sel, sty]) => {
                const addSurface = () => {
                    glviewer.addSurface(SurfaceType.VDW, sty || {}, sel || {}, sel || {})
                        .then((surfid: any) => {
                            if (UI) UI.loadSurface("VDW", sel, sty, surfid);
                        });
                };

                if (UI) {
                    addSurface();
                } else {
                    glviewer.addSurface(SurfaceType.VDW, sty || {}, sel || {}, sel || {});
                }
            });

            labels.forEach(([sel, sty]) => {
                glviewer.addResLabels(sel || {}, sty || {});
            });

            glviewer.render();
            glviewer.zoomTo(zoomto);

            if (spin) {
                glviewer.spin(spin.axis, spin.speed);
            }
        };

        let glviewer = viewer;
        try {
            const config: ViewerSpec = {
                ...(dataset.config ? specStringToObject(dataset.config) : {}),
                backgroundColor: typeof bgcolor === 'string' ? bgcolor : bgcolor.getHex(),
                backgroundAlpha: bgalpha
            };

            if (!glviewer) {
                glviewer = viewers[viewerdiv.id || nviewers++] = createViewer(viewerdiv, config);
            } else {
                glviewer.setBackgroundColor(config.backgroundColor, config.backgroundAlpha);
                glviewer.setConfig(config);
            }

            let UI: UIManager | null = null;
            if (dataset.ui && ($3Dmol as any).StateManager) {
                UI = new ($3Dmol as any).StateManager(glviewer) as UIManager;
                UI.initiateUI();
            }

            if (datauri.length > 0) {
                handleDataUri(glviewer, datauri, datatypes, options, viewerdiv, UI, applyStyles, callback);
            } else if (dataset.element) {
                const moldataid = `#${dataset.element}`;
                const molelem = document.querySelector(moldataid);
                const moldata = molelem ? molelem.textContent : "";
                const type = dataset.type || dataset.datatype;
                glviewer.addModel(moldata, type, options);

                applyStyles(glviewer, UI);
                if (dataset.callback) {
                    const runres = makeFunction(dataset.callback);
                    runres(glviewer);
                }
                processing_autoinit = false;
                callback?.(glviewer);
            }
        } catch (error) {
            console.error(error);
            viewerdiv.textContent = "WebGL appears to be disabled.";
        }
    });
};

document.addEventListener('DOMContentLoaded', () => {
    autoload();
});