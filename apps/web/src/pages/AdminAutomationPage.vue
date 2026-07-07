<script setup lang="ts">
import { AutomationRuleDto, AutomationRunResultDto } from '@tickets/shared';
import { onMounted, ref } from 'vue';
import { AdminApi } from '../lib/api';

const rules = ref<AutomationRuleDto[]>([]);
const runResult = ref<AutomationRunResultDto | null>(null);
const running = ref(false);
const error = ref('');
const notice = ref('');

const RULE_META: Record<
  string,
  { title: string; description: string; paramKey: string; paramLabel: string }
> = {
  auto_close_resolved: {
    title: 'Auto-close resolved tickets',
    description:
      'Tickets that stay in "Resolved" without a requester reply are closed automatically; the requester gets a notification.',
    paramKey: 'days',
    paramLabel: 'After (days)',
  },
  escalate_unassigned: {
    title: 'Escalate unassigned tickets',
    description:
      'When a new ticket has no assignee for too long, managers are notified (once per ticket) and the escalation lands on the timeline.',
    paramKey: 'hours',
    paramLabel: 'After (hours)',
  },
};

onMounted(async () => {
  rules.value = await AdminApi.automationRules();
});

async function save(): Promise<void> {
  error.value = '';
  try {
    rules.value = await AdminApi.saveAutomationRules(rules.value);
    notice.value = 'Automation rules saved.';
    setTimeout(() => (notice.value = ''), 4000);
  } catch (err) {
    error.value = (err as Error).message;
  }
}

async function runNow(): Promise<void> {
  running.value = true;
  error.value = '';
  try {
    runResult.value = await AdminApi.runAutomation();
  } catch (err) {
    error.value = (err as Error).message;
  } finally {
    running.value = false;
  }
}
</script>

<template>
  <div class="page">
    <h2>Automation</h2>
    <p class="muted intro">
      Rules run every 5 minutes. Their actions appear on ticket timelines marked as automatic.
    </p>

    <div v-for="rule in rules" :key="rule.type" class="card rule-card">
      <label class="check head">
        <input v-model="rule.enabled" type="checkbox" />
        <strong>{{ RULE_META[rule.type]?.title ?? rule.type }}</strong>
      </label>
      <p class="muted desc">{{ RULE_META[rule.type]?.description }}</p>
      <div class="param">
        <label class="mini">{{ RULE_META[rule.type]?.paramLabel }}</label>
        <input
          v-model.number="rule.params[RULE_META[rule.type]?.paramKey ?? '']"
          type="number"
          min="0"
          step="1"
        />
      </div>
    </div>

    <div class="actions">
      <button class="btn btn-primary" type="button" @click="save">Save rules</button>
      <button class="btn" type="button" :disabled="running" @click="runNow">
        {{ running ? 'Running…' : 'Run now' }}
      </button>
      <span v-if="runResult" class="muted">
        Last run: {{ runResult.closed }} closed, {{ runResult.escalated }} escalated,
        {{ runResult.maintenanceCreated }} maintenance tickets.
      </span>
    </div>

    <p v-if="error" class="error-text">{{ error }}</p>
    <p v-if="notice" class="notice">{{ notice }}</p>
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  max-width: 640px;
}

.page h2 {
  margin: 0;
}

.intro {
  margin: 0;
  font-size: 0.9rem;
}

.rule-card {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.check {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}

.check input {
  width: auto;
}

.desc {
  margin: 0;
  font-size: 0.88rem;
}

.param {
  max-width: 180px;
}

.mini {
  display: block;
  font-size: 0.75rem;
  color: var(--text-muted);
  margin-bottom: 0.2rem;
}

.actions {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.notice {
  color: #2ea05a;
  font-size: 0.9rem;
}
</style>
