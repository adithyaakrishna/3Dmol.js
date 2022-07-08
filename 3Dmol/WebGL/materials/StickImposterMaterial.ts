import { ImposterMaterial } from './ImposterMaterial';
export class StickImposterMaterial extends ImposterMaterial{
    constructor(parameters?: any) {

    super(parameters);

    this.shaderID = "stickimposter";
    this.setValues(parameters);

};

clone() {

    var material = new StickImposterMaterial();
    super.clone.call(this, material);
    return material;
};
}
