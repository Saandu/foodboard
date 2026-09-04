<template>
  <div v-if="open" class="modal-backdrop" @click.self="close">
    <form class="feedback-dialog" role="dialog" aria-modal="true" :aria-label="$t('send_feedback')" @submit.prevent="send">
      <header><div><span>{{ $t('feedback') }}</span><h2>{{ $t('send_feedback') }}</h2></div><button type="button" class="icon-btn" :aria-label="$t('close')" @click="close"><font-awesome-icon icon="fa-solid fa-xmark" /></button></header>
      <p>{{ $t('send_feedback_prompt') }}</p>
      <label><span>{{ $t('subject') }}*</span><input v-model.trim="subject" type="text" :aria-invalid="subjectError" /><small v-if="subjectError" role="alert">{{ $t('field_required') }}</small></label>
      <label><span>{{ $t('message') }}*</span><textarea v-model.trim="message" rows="6" :aria-invalid="messageError"></textarea><small v-if="messageError" role="alert">{{ $t('field_required') }}</small></label>
      <label><span>{{ $t('attachment') }}</span><input type="file" :accept="ACCEPTED_IMAGE_TYPES" :disabled="busy" @change="getPicture" /><small v-if="attachmentError" role="alert">{{ $t(attachmentError) }}</small></label>
      <p v-if="feedbackState" class="feedback-state" role="status">{{ $t(feedbackState) }}</p>
      <p v-if="sendError" class="feedback-error" role="alert">{{ $t(sendError) }}</p>
      <footer><button type="button" class="btn btn-quiet" :disabled="busy" @click="close">{{ $t('cancel') }}</button><button type="submit" class="btn btn-primary" :disabled="busy">{{ busy ? $t('sending') : $t('send') }}</button></footer>
    </form>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { useStore } from '../stores/store.js'
import { ACCEPTED_IMAGE_TYPES, uploadStructureImage } from '../media.js'

const emits = defineEmits(['closeFeedback'])
defineProps({ open: { type: Boolean, required: true } })
const store = useStore()
const subject = ref('')
const message = ref('')
const attachment = ref('')
const subjectError = ref(false)
const messageError = ref(false)
const attachmentError = ref('')
const feedbackState = ref('')
const sendError = ref('')
const busy = ref(false)

// A screenshot goes to Storage under <uid>/feedback/, which satisfies the same
// owner-scoped policy as every other upload, and is compressed on the way.
const getPicture = async (event) => {
  const input = event.target
  const file = input.files?.[0]
  if (!file) return
  attachmentError.value = ''
  busy.value = true
  try {
    attachment.value = await uploadStructureImage(file, {
      userId: store.user.user_id,
      structureId: 'feedback',
      field: 'attachment'
    })
  } catch (err) {
    attachmentError.value = err.message
    input.value = ''
  } finally {
    busy.value = false
  }
}

const close = () => {
  emits('closeFeedback')
  subject.value = ''
  message.value = ''
  attachment.value = ''
  feedbackState.value = ''
  sendError.value = ''
  attachmentError.value = ''
  subjectError.value = false
  messageError.value = false
}

const send = async () => {
  subjectError.value = !subject.value
  messageError.value = !message.value
  if (subjectError.value || messageError.value) return

  sendError.value = ''
  busy.value = true
  try {
    await store.sendFeedback({
      subject: subject.value,
      message: message.value,
      attachment: attachment.value
    })
    feedbackState.value = 'feedback_sent'
    window.setTimeout(close, 1400)
  } catch (err) {
    sendError.value = err.message
  } finally {
    busy.value = false
  }
}
</script>

<style scoped>
.modal-backdrop { position: fixed; inset: 0; z-index: var(--z-modal); display: grid; place-items: center; padding: var(--s-4); background: rgba(12, 24, 18, .58); }.feedback-dialog { width: min(100%, 580px); display: grid; gap: var(--s-4); padding: var(--s-5); background: var(--c-surface); border-radius: var(--r-md); box-shadow: var(--shadow-lg); }.feedback-dialog header { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--s-4); }.feedback-dialog header span, .feedback-dialog label > span { display: block; color: var(--c-ink-3); font-size: .72rem; font-weight: 750; letter-spacing: .06em; text-transform: uppercase; }.feedback-dialog h2 { margin-top: var(--s-1); font-size: 1.25rem; }.feedback-dialog > p { color: var(--c-ink-2); font-size: .9rem; line-height: 1.5; }.feedback-dialog label { display: grid; gap: var(--s-2); }.feedback-dialog input:not([type=file]), .feedback-dialog textarea { width: 100%; padding: var(--s-2) var(--s-3); color: var(--c-ink); font: .95rem/1.45 inherit; background: var(--c-surface); border: 1px solid var(--c-line-strong); border-radius: var(--r-sm); }.feedback-dialog input:focus, .feedback-dialog textarea:focus { outline: 2px solid var(--c-brand); outline-offset: 1px; border-color: var(--c-brand); }.feedback-dialog input[aria-invalid=true], .feedback-dialog textarea[aria-invalid=true] { border-color: var(--c-danger); }.feedback-dialog small { color: var(--c-danger); font-size: .78rem; }.feedback-dialog input[type=file] { color: var(--c-ink-2); font: .85rem/1.2 inherit; }.feedback-state { color: var(--c-success) !important; font-weight: 650; }.feedback-error { color: var(--c-danger) !important; font-weight: 650; }.feedback-dialog footer { display: flex; justify-content: flex-end; gap: var(--s-2); padding-top: var(--s-3); border-top: 1px solid var(--c-line); }@media (max-width: 480px) { .feedback-dialog { padding: var(--s-4); }.feedback-dialog footer .btn { flex: 1; } }
</style>
