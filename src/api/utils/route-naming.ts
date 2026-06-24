import { pluralize } from '../../db/utils/naming.js';

function toKebabCase(value: string): string {
  return value.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

export function toRouteBasePath(modelName: string): string {
  const camel = modelName.charAt(0).toLowerCase() + modelName.slice(1);
  return pluralize(toKebabCase(camel));
}

export function toRouteFileName(modelName: string): string {
  return `${toRouteBasePath(modelName)}.ts`;
}
