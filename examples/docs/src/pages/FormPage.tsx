import { createComponent } from '@liteforge/runtime';
import { createForm } from '@liteforge/form';
import { z } from 'zod';
import { DocSection } from '../components/DocSection.js';
import { CodeBlock } from '../components/CodeBlock.js';
import { LiveExample } from '../components/LiveExample.js';
import { ApiTable } from '../components/ApiTable.js';
import type { ApiRow } from '../components/ApiTable.js';

// ─── Live example ─────────────────────────────────────────────────────────────

function LoginFormExample(): Node {
  const form = createForm({
    schema: z.object({
      email: z.string().email('Please enter a valid email'),
      password: z.string().min(8, 'Password must be at least 8 characters'),
    }),
    initial: { email: '', password: '' },
    onSubmit: async (values) => {
      await new Promise(r => setTimeout(r, 600));
      console.log('[Form] submitted', values);
    },
    validateOn: 'blur',
    revalidateOn: 'change',
  });

  const wrap = document.createElement('div');
  wrap.className = 'space-y-3 max-w-sm';

  function field(name: 'email' | 'password', type: string, label: string): Node {
    const f = form.field(name);
    const group = document.createElement('div');

    const lbl = document.createElement('label');
    lbl.className = 'block text-xs text-neutral-400 mb-1';
    lbl.textContent = label;

    const inp = document.createElement('input');
    inp.type = type;
    inp.className = 'w-full px-3 py-1.5 rounded bg-neutral-800 border text-sm text-white focus:outline-none transition-colors';
    inp.placeholder = label;

    import('@liteforge/core').then(({ effect }) => {
      effect(() => {
        const err = f.error();
        inp.className = `w-full px-3 py-1.5 rounded bg-neutral-800 border text-sm text-white focus:outline-none transition-colors ${err !== undefined ? 'border-red-500' : 'border-neutral-700 focus:border-indigo-500'}`;
      });

      inp.addEventListener('blur', () => f.touch());
      inp.addEventListener('input', () => f.set(inp.value));

      const errEl = document.createElement('p');
      errEl.className = 'text-xs text-red-400 mt-0.5 min-h-4';
      effect(() => { errEl.textContent = f.error() ?? ''; });

      group.appendChild(lbl);
      group.appendChild(inp);
      group.appendChild(errEl);
    });

    return group;
  }

  const submitBtn = document.createElement('button');
  submitBtn.type = 'submit';
  submitBtn.className = 'w-full py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors disabled:opacity-50';

  import('@liteforge/core').then(({ effect }) => {
    effect(() => {
      submitBtn.textContent = form.isSubmitting() ? 'Logging in…' : 'Log in';
      submitBtn.disabled = form.isSubmitting();
    });
  });

  submitBtn.addEventListener('click', () => form.submit());

  wrap.appendChild(field('email', 'email', 'Email'));
  wrap.appendChild(field('password', 'password', 'Password'));
  wrap.appendChild(submitBtn);
  return wrap;
}

// ─── Code strings ─────────────────────────────────────────────────────────────

const SETUP_CODE = `import { createForm } from '@liteforge/form';
import { z } from 'zod';

const form = createForm({
  schema: z.object({
    email:    z.string().email(),
    password: z.string().min(8),
  }),
  initial: { email: '', password: '' },
  onSubmit: async (values) => {
    await api.login(values);
  },
  validateOn: 'blur',    // validate field when focus leaves
  revalidateOn: 'change', // re-validate on each keystroke after first error
});`;

const FIELD_CODE = `const emailField = form.field('email');

emailField.value()    // current value (Signal)
emailField.error()    // validation error message | undefined
emailField.touched()  // was field blurred?
emailField.dirty()    // was field modified?

emailField.set('anna@example.com');  // programmatic update
emailField.blur();    // trigger validation

// In JSX:
<input
  value={() => emailField.value()}
  oninput={e => emailField.set(e.target.value)}
  onblur={() => emailField.blur()}
/>
{() => emailField.error()
  ? <p class="error">{emailField.error()}</p>
  : null}`;

const ZOD_CODE = `const appointmentSchema = z.object({
  patientId:   z.number().positive(),
  doctorId:    z.number().positive(),
  date:        z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD format'),
  duration:    z.number().min(15).max(120),
  notes:       z.string().max(500).optional(),
});

const form = createForm({
  schema: appointmentSchema,
  initial: { patientId: 0, doctorId: 0, date: '', duration: 30, notes: '' },
  onSubmit: async (values) => {
    await appointments.create(values);
  },
});`;

const ARRAY_CODE = `const form = createForm({
  schema: z.object({
    medications: z.array(z.object({
      name:  z.string().min(1),
      dosage: z.string().min(1),
    })),
  }),
  initial: { medications: [] },
  onSubmit: async (values) => { ... },
});

const meds = form.array('medications');

meds.append({ name: '', dosage: '' });
meds.remove(0);
meds.items()  // ArrayItemField[]

// Each item has .field('name'), .field('dosage')
meds.items()[0]?.field('name').value()`;

const FORM_STATE_CODE = `form.isSubmitting()   // loading state during onSubmit
form.isValid()        // no validation errors
form.isDirty()        // any field modified from initial value
form.errors()         // Record<fieldName, errorMessage>
form.submit()         // trigger validation + onSubmit
form.reset()          // reset to initial values`;

const LIVE_CODE = `const form = createForm({
  schema: z.object({
    email:    z.string().email(),
    password: z.string().min(8),
  }),
  initial: { email: '', password: '' },
  onSubmit: async (values) => api.login(values),
  validateOn: 'blur',
});

const email = form.field('email');

<input
  oninput={e => email.set(e.target.value)}
  onblur={() => email.blur()}
/>
{() => email.error() ? <p>{email.error()}</p> : null}
<button onclick={() => form.submit()}>
  {() => form.isSubmitting() ? 'Loading…' : 'Log in'}
</button>`;

// ─── API rows ─────────────────────────────────────────────────────────────────

const FORM_API: ApiRow[] = [
  { name: 'schema', type: 'ZodSchema', description: 'Zod schema for validation — defines the shape and rules' },
  { name: 'initial', type: 'T', description: 'Initial values for all fields' },
  { name: 'onSubmit', type: '(values: T) => Promise<void>', description: 'Called when form is submitted and validation passes' },
  { name: 'validateOn', type: "'blur' | 'change' | 'submit'", default: "'submit'", description: 'When to run validation for the first time' },
  { name: 'revalidateOn', type: "'blur' | 'change'", default: "'change'", description: 'When to re-run validation after first error' },
];

export const FormPage = createComponent({
  name: 'FormPage',
  component() {
    return (
      <div>
        <div class="mb-10">
          <p class="text-xs font-mono text-neutral-500 mb-1">@liteforge/form</p>
          <h1 class="text-3xl font-bold text-white mb-2">Form Management</h1>
          <p class="text-neutral-400 leading-relaxed max-w-xl">
            Signal-based form state with Zod validation. Field-level error tracking,
            array fields, submission state — all as reactive signals.
          </p>
          <CodeBlock code={`pnpm add @liteforge/form zod`} language="bash" />
          <CodeBlock code={`import { createForm } from '@liteforge/form';\nimport { z } from 'zod';`} language="typescript" />
        </div>

        <DocSection
          title="createForm()"
          id="create-form"
          description="Define schema, initial values, and submission handler. Returns a form instance with reactive field signals."
        >
          <div>
            <CodeBlock code={SETUP_CODE} language="typescript" />
            <ApiTable rows={FORM_API} />
          </div>
        </DocSection>

        <DocSection
          title="Field binding"
          id="fields"
          description="form.field(name) returns reactive signals for value, error, touched, and dirty state."
        >
          <CodeBlock code={FIELD_CODE} language="tsx" />
        </DocSection>

        <DocSection
          title="Zod schema validation"
          id="validation"
          description="Use the full Zod API for validation rules. Error messages are reactive — update automatically as the user types."
        >
          <CodeBlock code={ZOD_CODE} language="typescript" />
        </DocSection>

        <DocSection
          title="Array fields"
          id="arrays"
          description="Dynamic lists (medications, addresses, contacts) with append/remove and per-item field access."
        >
          <CodeBlock code={ARRAY_CODE} language="typescript" />
        </DocSection>

        <DocSection
          title="Form state signals"
          id="state"
        >
          <CodeBlock code={FORM_STATE_CODE} language="typescript" />
        </DocSection>

        <DocSection
          title="Live example"
          id="live"
        >
          <LiveExample
            title="Login form with Zod validation"
            description="Blur a field to trigger validation"
            component={LoginFormExample}
            code={LIVE_CODE}
          />
        </DocSection>
      </div>
    );
  },
});
