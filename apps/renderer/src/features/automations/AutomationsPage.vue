<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import type { Employee, EmployeeId, Conversation } from '../../app/workspace';
import type { ProviderConfig, ProviderId } from '../../app/model-config';
import { chatEndpointLabel } from '../../app/model-config';
import type { AutomationRunTranscript } from '../../app/automations';
import { useAutomations, type Automation, type AutomationSchedule } from '../../app/automations';
import { employeeDisplayName } from '../../app/employees';
import { useI18n } from '../../app/i18n';

const props = defineProps<{
  employees: Employee[];
  models: ProviderConfig[];
  conversations: Conversation[];
  runAutomation: (item: Automation) => Promise<AutomationRunTranscript | undefined>;
  openConversation: (id: string) => void;
}>();

const { t } = useI18n();
const { automations, load, save, update, remove, beginRun, finishRun } = useAutomations();
const editorOpen = ref(false);
const editingId = ref('');
const runningId = ref('');
const error = ref('');
const weekdayLabels = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const form = ref(emptyForm());

function emptyForm() {
  return {
    name: '',
    prompt: '',
    employeeId: (props?.employees?.[0]?.id || 'general') as EmployeeId,
    modelId: props?.models?.[0]?.id || '',
    kind: 'recurring' as 'once' | 'recurring',
    at: '',
    frequency: 'daily' as 'daily' | 'weekly' | 'monthly',
    time: '09:00',
    weekdays: [1] as number[],
    dayOfMonth: 1,
    enabled: true,
  };
}

const enabledCount = computed(() => automations.value.filter((item) => item.enabled).length);

function formatDate(value?: number) {
  return value ? new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(value) : '尚未执行';
}

function toLocalDateTime(value: number) {
  const date = new Date(value - new Date(value).getTimezoneOffset() * 60_000);
  return date.toISOString().slice(0, 16);
}

function scheduleLabel(item: Automation) {
  if (item.schedule.kind === 'once') return `单次 · ${formatDate(item.schedule.at)}`;
  if (item.schedule.kind === 'interval') return `每 ${item.schedule.everyMinutes} 分钟`;
  if (item.schedule.frequency === 'daily') return `每天 ${item.schedule.time}`;
  if (item.schedule.frequency === 'weekly') return `每周${(item.schedule.weekdays ?? []).map((day) => weekdayLabels[day]).join('、')} ${item.schedule.time}`;
  return `每月 ${item.schedule.dayOfMonth ?? 1} 日 ${item.schedule.time}`;
}

function openCreate() {
  form.value = emptyForm();
  editingId.value = '';
  error.value = '';
  editorOpen.value = true;
}

function openEdit(item: Automation) {
  const selectedModel = props.models.find((model) => model.id === item.modelId) ?? props.models.find((model) => model.provider === item.provider);
  form.value = {
    name: item.name,
    prompt: item.prompt,
    employeeId: item.employeeId,
    modelId: selectedModel?.id ?? '',
    kind: item.schedule.kind === 'once' ? 'once' : 'recurring',
    at: item.schedule.kind === 'once' ? toLocalDateTime(item.schedule.at) : '',
    frequency: item.schedule.kind === 'recurring' ? item.schedule.frequency : 'daily',
    time: item.schedule.kind === 'recurring' ? item.schedule.time : '09:00',
    weekdays: item.schedule.kind === 'recurring' ? [...(item.schedule.weekdays ?? [1])] : [1],
    dayOfMonth: item.schedule.kind === 'recurring' ? item.schedule.dayOfMonth ?? 1 : 1,
    enabled: item.enabled,
  };
  editingId.value = item.id;
  error.value = '';
  editorOpen.value = true;
}

function closeEditor() {
  editorOpen.value = false;
  editingId.value = '';
  error.value = '';
}

function buildSchedule(): AutomationSchedule | null {
  if (form.value.kind === 'once') {
    const at = new Date(form.value.at).getTime();
    return Number.isFinite(at) ? { kind: 'once', at } : null;
  }
  if (form.value.frequency === 'weekly' && !form.value.weekdays.length) return null;
  return {
    kind: 'recurring',
    frequency: form.value.frequency,
    time: form.value.time,
    ...(form.value.frequency === 'weekly' ? { weekdays: [...form.value.weekdays] } : {}),
    ...(form.value.frequency === 'monthly' ? { dayOfMonth: form.value.dayOfMonth } : {}),
  };
}

function nextScheduledAt(schedule: AutomationSchedule, from = Date.now()) {
  if (schedule.kind === 'once') return schedule.at;
  if (schedule.kind === 'interval') return from + schedule.everyMinutes * 60_000;
  const [hours, minutes] = schedule.time.split(':').map(Number);
  const candidate = new Date(from);
  candidate.setHours(hours || 0, minutes || 0, 0, 0);
  if (schedule.frequency === 'daily') {
    if (candidate.getTime() <= from) candidate.setDate(candidate.getDate() + 1);
    return candidate.getTime();
  }
  if (schedule.frequency === 'weekly') {
    const weekdays = schedule.weekdays?.length ? schedule.weekdays : [1];
    for (let offset = 0; offset <= 7; offset += 1) {
      const next = new Date(candidate);
      next.setDate(candidate.getDate() + offset);
      if (weekdays.includes(next.getDay()) && next.getTime() > from) return next.getTime();
    }
  }
  candidate.setDate(Math.min(Math.max(1, schedule.dayOfMonth ?? 1), 28));
  if (candidate.getTime() <= from) candidate.setMonth(candidate.getMonth() + 1);
  return candidate.getTime();
}

async function submit() {
  error.value = '';
  const model = props.models.find((item) => item.id === form.value.modelId);
  const schedule = buildSchedule();
  if (!form.value.name.trim() || !form.value.prompt.trim() || !model || !schedule) {
    error.value = '请填写任务名称、执行内容、模型和有效的执行计划。';
    return;
  }
  if (editingId.value) {
    const item = automations.value.find((candidate) => candidate.id === editingId.value);
    if (!item) return;
    Object.assign(item, {
      name: form.value.name.trim(),
      prompt: form.value.prompt.trim(),
      employeeId: form.value.employeeId,
      provider: model.provider as ProviderId,
      modelId: model.id,
      schedule,
      enabled: form.value.enabled,
      nextRunAt: nextScheduledAt(schedule),
    });
    await update(item);
  } else {
    await save({
      name: form.value.name.trim(),
      prompt: form.value.prompt.trim(),
      employeeId: form.value.employeeId,
      provider: model.provider as ProviderId,
      modelId: model.id,
      skillIds: [],
      schedule,
      enabled: form.value.enabled,
    });
  }
  closeEditor();
}

async function toggle(item: Automation) {
  item.enabled = !item.enabled;
  await update(item);
}

async function run(item: Automation) {
  runningId.value = item.id;
  const record = await beginRun(item, 'manual');
  try {
    const transcript = await props.runAutomation(item);
    item.lastRunAt = Date.now();
    item.lastStatus = 'success';
    item.lastError = undefined;
    await Promise.all([update(item), finishRun(record, 'success', undefined, transcript)]);
  } catch (cause) {
    item.lastRunAt = Date.now();
    item.lastStatus = 'failed';
    item.lastError = cause instanceof Error ? cause.message : '运行失败';
    await Promise.all([update(item), finishRun(record, 'failed', item.lastError)]);
  } finally {
    runningId.value = '';
  }
}

async function destroy(item: Automation) {
  if (!window.confirm(`删除定时任务“${item.name}”？`)) return;
  await remove(item.id);
}

onMounted(async () => {
  await load();
  form.value = emptyForm();
});
</script>

<template>
  <section class="h-full overflow-y-auto">
    <div class="mx-auto w-full max-w-5xl px-6 py-10 sm:px-12 sm:py-12">
      <header class="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p class="text-[11px] font-extrabold tracking-[.13em] text-[var(--accent)]">QuantumAI / SCHEDULED TASKS</p>
          <h1 class="mt-2 text-4xl font-bold tracking-[-.045em]">定时任务</h1>
          <p class="mt-3 text-[var(--muted)]">为数字员工设置简单的单次或周期任务。应用运行期间会按计划自动执行。</p>
        </div>
        <button class="rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white" type="button" @click="openCreate">＋ 新建任务</button>
      </header>

      <div class="mt-7 grid gap-3 sm:grid-cols-3">
        <div class="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4"><p class="text-xs text-[var(--muted)]">任务总数</p><strong class="mt-2 block text-2xl">{{ automations.length }}</strong></div>
        <div class="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4"><p class="text-xs text-[var(--muted)]">运行中</p><strong class="mt-2 block text-2xl text-emerald-600">{{ enabledCount }}</strong></div>
        <div class="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4"><p class="text-xs text-[var(--muted)]">已暂停</p><strong class="mt-2 block text-2xl">{{ automations.length - enabledCount }}</strong></div>
      </div>

      <section v-if="editorOpen" class="mt-6 overflow-hidden rounded-2xl border border-[var(--accent)]/30 bg-[var(--surface)] shadow-sm">
        <div class="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
          <div><h2 class="font-bold">{{ editingId ? '编辑定时任务' : '新建定时任务' }}</h2><p class="mt-1 text-xs text-[var(--muted)]">填写执行内容和时间即可保存。</p></div>
          <button class="rounded-lg px-3 py-2 text-sm text-[var(--muted)] hover:bg-[var(--surface-muted)]" type="button" @click="closeEditor">关闭</button>
        </div>
        <div class="grid gap-4 p-6 md:grid-cols-2">
          <label class="field">任务名称<input v-model="form.name" placeholder="例如：每日工作简报"></label>
          <label class="field">数字员工<select v-model="form.employeeId"><option v-for="employee in employees" :key="employee.id" :value="employee.id">{{ employeeDisplayName(employee, t) }}</option></select></label>
          <label class="field md:col-span-2">执行内容<textarea v-model="form.prompt" rows="4" placeholder="说明希望数字员工按时完成的工作"></textarea></label>
          <label class="field">模型<select v-model="form.modelId"><option disabled value="">选择模型</option><option v-for="model in models" :key="model.id" :value="model.id">{{ chatEndpointLabel(model) }}</option></select></label>
          <label class="field">任务类型<select v-model="form.kind"><option value="once">单次任务</option><option value="recurring">周期任务</option></select></label>
          <label v-if="form.kind === 'once'" class="field">执行时间<input v-model="form.at" type="datetime-local"></label>
          <template v-else>
            <label class="field">执行周期<select v-model="form.frequency"><option value="daily">每天</option><option value="weekly">每周</option><option value="monthly">每月</option></select></label>
            <label class="field">执行时间<input v-model="form.time" type="time"></label>
            <fieldset v-if="form.frequency === 'weekly'" class="md:col-span-2"><legend class="text-sm font-semibold">执行日期</legend><div class="mt-2 flex flex-wrap gap-2"><label v-for="(label, day) in weekdayLabels" :key="day" :class="['cursor-pointer rounded-lg border px-3 py-2 text-xs', form.weekdays.includes(day) ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]' : 'border-[var(--border)]']"><input v-model="form.weekdays" class="sr-only" type="checkbox" :value="day">{{ label }}</label></div></fieldset>
            <label v-if="form.frequency === 'monthly'" class="field">每月日期<select v-model.number="form.dayOfMonth"><option v-for="day in 28" :key="day" :value="day">每月 {{ day }} 日</option></select></label>
          </template>
          <label class="flex items-center gap-2 text-sm font-semibold md:col-span-2"><input v-model="form.enabled" type="checkbox">保存后立即启用</label>
          <p v-if="error" class="text-sm text-rose-600 md:col-span-2">{{ error }}</p>
          <div class="flex justify-end gap-3 md:col-span-2"><button class="secondary" type="button" @click="closeEditor">取消</button><button class="primary" type="button" @click="submit">{{ editingId ? '保存修改' : '创建任务' }}</button></div>
        </div>
      </section>

      <section class="mt-6 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm">
        <div class="flex items-center justify-between border-b border-[var(--border)] px-5 py-4"><div><h2 class="text-sm font-bold">任务列表</h2><p class="mt-1 text-xs text-[var(--muted)]">管理执行计划、状态和最近一次结果。</p></div></div>
        <div v-if="!automations.length" class="px-6 py-20 text-center"><span class="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[var(--accent-soft)] text-2xl">⏰</span><h2 class="mt-4 font-bold">还没有定时任务</h2><p class="mt-2 text-sm text-[var(--muted)]">创建一个任务，设置执行内容和时间即可开始。</p><button class="primary mt-5" type="button" @click="openCreate">创建第一个任务</button></div>
        <article v-for="item in automations" v-else :key="item.id" class="flex flex-wrap items-center gap-4 border-b border-[var(--border)] p-5 last:border-0">
          <button :class="['h-6 w-11 rounded-full p-1 transition-colors', item.enabled ? 'bg-emerald-500' : 'bg-slate-300']" type="button" :aria-label="item.enabled ? '暂停任务' : '启用任务'" @click="toggle(item)"><span :class="['block h-4 w-4 rounded-full bg-white transition-transform', item.enabled ? 'translate-x-5' : 'translate-x-0']"></span></button>
          <div class="min-w-[240px] flex-1"><div class="flex flex-wrap items-center gap-2"><h3 class="font-bold">{{ item.name }}</h3><span :class="['rounded-md px-2 py-0.5 text-[10px] font-semibold', item.enabled ? 'bg-emerald-500/10 text-emerald-600' : 'bg-slate-500/10 text-slate-500']">{{ item.enabled ? '已启用' : '已暂停' }}</span></div><p class="mt-1 line-clamp-2 text-sm text-[var(--muted)]">{{ item.prompt }}</p><p class="mt-2 text-xs text-[var(--muted)]">{{ scheduleLabel(item) }} · 下次：{{ item.enabled ? formatDate(item.nextRunAt) : '—' }} · 上次：{{ formatDate(item.lastRunAt) }}</p><p v-if="item.lastError" class="mt-1 text-xs text-rose-600">{{ item.lastError }}</p></div>
          <div class="flex gap-2"><button class="secondary" type="button" :disabled="runningId === item.id" @click="run(item)">{{ runningId === item.id ? '执行中…' : '立即执行' }}</button><button class="secondary" type="button" @click="openEdit(item)">编辑</button><button class="danger" type="button" @click="destroy(item)">删除</button></div>
        </article>
      </section>
    </div>
  </section>
</template>

<style scoped>
.field{display:grid;gap:7px;font-size:14px;font-weight:600}.field input,.field select,.field textarea{width:100%;border:1px solid var(--border);border-radius:12px;background:var(--surface-muted);padding:10px 12px;font:inherit;font-weight:400;color:var(--text);outline:none}.field input:focus,.field select:focus,.field textarea:focus{border-color:var(--accent)}button{transition:.18s}button:disabled{cursor:not-allowed;opacity:.5}.primary,.secondary,.danger{border-radius:10px;padding:9px 13px;font-size:13px;font-weight:650}.primary{background:var(--accent);color:white}.secondary{border:1px solid var(--border);background:var(--surface)}.secondary:hover{border-color:var(--accent);color:var(--accent)}.danger{color:#dc334f}.danger:hover{background:#dc334f12}
</style>
