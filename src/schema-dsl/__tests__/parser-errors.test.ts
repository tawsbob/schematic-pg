import { describe, it } from 'node:test';
import { expectParseError, wrapModels } from './helpers.js';

describe('Parser — errors', () => {
  it('throws when field is missing colon', () => {
    expectParseError(wrapModels('model User { id UUID }'), /expected ':'/);
  });

  it('throws when model is missing closing brace', () => {
    expectParseError(wrapModels('model User { id: UUID'), /expected 'model'|expected '\}'/);
  });

  it('throws when sections appear out of order', () => {
    expectParseError(
      'models {}\nextensions {}',
      /sections in order|expected end of schema/,
    );
  });

  it('throws when enums appear after models', () => {
    expectParseError(
      'models {}\nenums {}',
      /sections in order|expected end of schema/,
    );
  });

  it('throws when enum value is not an identifier', () => {
    expectParseError('extensions {}\nenums { Enum { 123 } }\nmodels {}', /expected identifier/);
  });

  it('throws when call expression has unclosed paren', () => {
    expectParseError(
      wrapModels('model User { id: UUID @default(gen_random_uuid('),
      /expected '\)'|expected value/,
    );
  });

  it('throws when model name is missing', () => {
    expectParseError(wrapModels('model { }'), /expected model name/);
  });

  it('throws when @ is not followed by attribute name', () => {
    expectParseError(wrapModels('model User { id: UUID @('), /expected attribute name/);
  });
});
