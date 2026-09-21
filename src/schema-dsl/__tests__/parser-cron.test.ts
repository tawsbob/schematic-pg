import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { expectParseError, parseSnippet } from './helpers.js';

function wrapCron(body: string, extras = ''): string {
  return `extensions { pg_cron }\nenums {}\nmodels {}\nfunctions {}\ncron { ${body} }${extras}`;
}

function parseJob(body: string) {
  return parseSnippet(wrapCron(body)).jobs[0];
}

describe('Parser — cron jobs', () => {
  it('defaults to an empty jobs list when the section is omitted', () => {
    const schema = parseSnippet('extensions {}\nenums {}\nmodels {}');
    assert.deepEqual(schema.jobs, []);
  });

  it('parses an empty cron section', () => {
    const schema = parseSnippet('extensions {}\nenums {}\nmodels {}\ncron {}');
    assert.deepEqual(schema.jobs, []);
  });

  it('parses a job with schedule and execute string', () => {
    const job = parseJob(`
      job nightlyVacuum {
        schedule: "0 3 * * *"
        execute: "VACUUM ANALYZE"
      }
    `);

    assert.equal(job.kind, 'CronJob');
    assert.equal(job.name, 'nightlyVacuum');
    assert.equal(job.schedule, '0 3 * * *');
    assert.equal(job.execute, 'VACUUM ANALYZE');
    assert.equal(job.call, undefined);
  });

  it('parses a job with triple-quoted execute', () => {
    const job = parseJob(`
      job purgeOldLogs {
        schedule: "30 seconds"
        execute: """
          DELETE FROM log
          WHERE created_at < now() - interval '30 days'
        """
      }
    `);

    assert.equal(job.schedule, '30 seconds');
    assert.match(job.execute ?? '', /DELETE FROM log/);
    assert.equal(job.call, undefined);
  });

  it('parses a job with call identifier', () => {
    const schema = parseSnippet(`extensions { pg_cron }
functions {
  function expireStaleSessions(): VOID {
    execute: """SELECT 1"""
  }
}
cron {
  job expireStaleSessions {
    schedule: "0 * * * *"
    call: expireStaleSessions
  }
}`);

    const job = schema.jobs[0];
    assert.equal(job.name, 'expireStaleSessions');
    assert.equal(job.schedule, '0 * * * *');
    assert.equal(job.call, 'expireStaleSessions');
    assert.equal(job.execute, undefined);
  });

  it('parses comma-separated job body keys', () => {
    const job = parseJob(`
      job nightlyVacuum {
        schedule: "0 3 * * *",
        execute: "VACUUM ANALYZE",
      }
    `);

    assert.equal(job.schedule, '0 3 * * *');
    assert.equal(job.execute, 'VACUUM ANALYZE');
  });

  it('parses multiple jobs', () => {
    const schema = parseSnippet(wrapCron(`
      job alpha {
        schedule: "0 * * * *"
        execute: "SELECT 1"
      }
      job beta {
        schedule: "0 3 * * *"
        execute: "SELECT 2"
      }
    `));

    assert.equal(schema.jobs.length, 2);
    assert.equal(schema.jobs[0].name, 'alpha');
    assert.equal(schema.jobs[1].name, 'beta');
  });

  it('throws on duplicate job names in the same section', () => {
    expectParseError(
      wrapCron(`
        job nightlyVacuum {
          schedule: "0 3 * * *"
          execute: "VACUUM ANALYZE"
        }
        job nightlyVacuum {
          schedule: "0 4 * * *"
          execute: "VACUUM ANALYZE"
        }
      `),
      /unique job name/,
    );
  });

  it('throws when schedule is missing', () => {
    expectParseError(
      wrapCron(`
        job nightlyVacuum {
          execute: "VACUUM ANALYZE"
        }
      `),
      /schedule/,
    );
  });

  it('throws when both execute and call are present', () => {
    expectParseError(
      wrapCron(`
        job nightlyVacuum {
          schedule: "0 3 * * *"
          execute: "VACUUM ANALYZE"
          call: someFn
        }
      `),
      /exactly one of 'execute' or 'call'/,
    );
  });

  it('throws when neither execute nor call is present', () => {
    expectParseError(
      wrapCron(`
        job nightlyVacuum {
          schedule: "0 3 * * *"
        }
      `),
      /execute' or 'call'/,
    );
  });

  it('throws when schedule is empty', () => {
    expectParseError(
      wrapCron(`
        job nightlyVacuum {
          schedule: "   "
          execute: "VACUUM ANALYZE"
        }
      `),
      /non-empty schedule/,
    );
  });

  it('throws when cron appears before functions', () => {
    expectParseError(
      `extensions {}\ncron {}\nfunctions {}`,
      /sections in order/,
    );
  });
});
