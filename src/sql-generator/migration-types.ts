export type Migration =
  | CreateExtension
  | DropExtension
  | CreateTable
  | DropTable
  | AddColumn
  | DropColumn
  | AlterColumn
  | CreateIndex
  | DropIndex
  | CreateEnum
  | AddEnumValue
  | AddConstraint
  | DropConstraint
  | CreateFunction
  | ReplaceFunction
  | DropFunction
  | CreateTrigger
  | DropTrigger
  | CreatePartition
  | DropPartition
  | ConvertToPartitioned
  | ConvertFromPartitioned
  | CreateView
  | ReplaceView
  | DropView
  | CreateMaterializedView
  | DropMaterializedView;

export interface CreateTable {
  kind: 'CreateTable';
  modelName: string;
}

export interface DropTable {
  kind: 'DropTable';
  modelName: string;
}

export interface AddColumn {
  kind: 'AddColumn';
  modelName: string;
  fieldName: string;
}

export interface DropColumn {
  kind: 'DropColumn';
  modelName: string;
  fieldName: string;
}

export interface AlterColumn {
  kind: 'AlterColumn';
  modelName: string;
  fieldName: string;
  change:
    | { type: 'type'; from: string; to: string }
    | { type: 'nullability'; from: boolean; to: boolean }
    | { type: 'default'; from?: string; to?: string };
}

export interface CreateIndex {
  kind: 'CreateIndex';
  modelName: string;
  signature: string;
}

export interface DropIndex {
  kind: 'DropIndex';
  modelName: string;
  signature: string;
}

export interface CreateEnum {
  kind: 'CreateEnum';
  enumName: string;
}

export interface AddEnumValue {
  kind: 'AddEnumValue';
  enumName: string;
  value: string;
}

export interface AddConstraint {
  kind: 'AddConstraint';
  modelName: string;
  constraintType: 'foreignKey' | 'primaryKey' | 'unique';
  details: string;
}

export interface DropConstraint {
  kind: 'DropConstraint';
  modelName: string;
  constraintType: 'foreignKey' | 'primaryKey' | 'unique';
  details: string;
}

export interface CreateExtension {
  kind: 'CreateExtension';
  extensionName: string;
}

export interface DropExtension {
  kind: 'DropExtension';
  extensionName: string;
}

export interface CreateTrigger {
  kind: 'CreateTrigger';
  modelName: string;
  signature: string;
}

export interface DropTrigger {
  kind: 'DropTrigger';
  modelName: string;
  signature: string;
}

export interface CreateFunction {
  kind: 'CreateFunction';
  functionName: string;
}

export interface ReplaceFunction {
  kind: 'ReplaceFunction';
  functionName: string;
}

export interface DropFunction {
  kind: 'DropFunction';
  functionName: string;
  signature: string;
}

export interface CreatePartition {
  kind: 'CreatePartition';
  modelName: string;
  partitionName: string;
}

export interface DropPartition {
  kind: 'DropPartition';
  modelName: string;
  partitionName: string;
  parentTable: string;
  tableName: string;
}

export interface ConvertToPartitioned {
  kind: 'ConvertToPartitioned';
  modelName: string;
}

export interface ConvertFromPartitioned {
  kind: 'ConvertFromPartitioned';
  modelName: string;
}

export interface CreateView {
  kind: 'CreateView';
  viewName: string;
}

export interface ReplaceView {
  kind: 'ReplaceView';
  viewName: string;
}

export interface DropView {
  kind: 'DropView';
  viewName: string;
}

export interface CreateMaterializedView {
  kind: 'CreateMaterializedView';
  viewName: string;
}

export interface DropMaterializedView {
  kind: 'DropMaterializedView';
  viewName: string;
}
