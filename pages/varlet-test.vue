<template>
  <div class="varlet-test">
    <var-app-bar title="Varlet 3 Test Page" />
    
    <div class="content">
      <var-space direction="column" :size="16">
        <var-card>
          <template #title>
            <var-icon name="check-circle" />
            Varlet 3 Components Test
          </template>
          
          <var-space direction="column" :size="12">
            <var-button type="primary" @click="showSnackbar">
              Test Snackbar
            </var-button>
            
            <var-button type="warning" @click="showDialog = true">
              Test Dialog
            </var-button>
            
            <var-switch v-model="switchValue" />
            
            <var-input 
              v-model="inputValue" 
              placeholder="Test input"
              variant="outlined"
            />
            
            <var-progress :value="progressValue" />
          </var-space>
        </var-card>
      </var-space>
    </div>

    <var-dialog v-model:show="showDialog" title="Test Dialog">
      <p>This is a test dialog using Varlet 3 components!</p>
      <template #actions>
        <var-button @click="showDialog = false">Close</var-button>
      </template>
    </var-dialog>

    <var-snackbar v-model:show="snackbarShow" type="success">
      Varlet 3 is working correctly!
    </var-snackbar>
  </div>
</template>

<script setup lang="ts">
const showDialog = ref(false)
const snackbarShow = ref(false)
const switchValue = ref(false)
const inputValue = ref('')
const progressValue = ref(75)

function showSnackbar() {
  snackbarShow.value = true
}
</script>

<style scoped>
.varlet-test {
  min-height: 100vh;
}

.content {
  padding: 20px;
}
</style>