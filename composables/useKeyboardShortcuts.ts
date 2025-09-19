import { useEventListener } from '@vueuse/core'

interface KeyboardShortcutOptions {
  onAddAccount?: () => void
  onSettings?: () => void
  onSwitchUser?: (userIndex: number) => void
}

export function useKeyboardShortcuts(options: KeyboardShortcutOptions) {
  const { onAddAccount, onSettings, onSwitchUser } = options

  useEventListener('keydown', (event: KeyboardEvent) => {
    // Only handle shortcuts when Alt key is pressed
    if (!event.altKey) return

    // Prevent default browser behavior for our shortcuts
    if (event.code === 'KeyA' || event.code === 'KeyS' || /^Digit[1-9]$/.test(event.code)) {
      event.preventDefault()
    }

    switch (event.code) {
      case 'KeyA':
        // Alt + A: Add account
        onAddAccount?.()
        break
      
      case 'KeyS':
        // Alt + S: Settings
        onSettings?.()
        break
      
      case 'Digit1':
      case 'Digit2':
      case 'Digit3':
      case 'Digit4':
      case 'Digit5':
      case 'Digit6':
      case 'Digit7':
      case 'Digit8':
      case 'Digit9':
        // Alt + 1-9: Switch to user account
        const userIndex = parseInt(event.code.replace('Digit', '')) - 1
        onSwitchUser?.(userIndex)
        break
    }
  })
}