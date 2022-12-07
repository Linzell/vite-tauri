<script setup lang="ts">
import { ref } from 'vue';
import { invoke } from '@tauri-apps/api/tauri';

const greetMsg = ref("");
const name = ref("");
const online = ref(false);

async function greet() {
  // Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
  greetMsg.value = await invoke("greet", { name: name.value });
}

async function yjsTest() {
  if (online.value) {
    online.value = false;
  } else {
    online.value = true;
  }
}
</script>

<template>
  <div class="card">
    <button type="button" @click="(yjsTest() as unknown as MouseEvent)">Yjs Test</button>
    {{ `You are : ${online ? 'en ligne' : 'offline'}` }}
  </div>
  <div class="card">
    <input id="greet-input" v-model="name" placeholder="Enter a name..." />
    <button type="button" @click="(greet() as unknown as MouseEvent)">Greet</button>
  </div>

  <p>{{ greetMsg }}</p>
</template>
