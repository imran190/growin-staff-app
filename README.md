# Growin Staff App - Expo React Native v1

This is the first native Expo project for Growin Staff CRM app.

## Run for iPhone / Android Expo Go

```bash
npm install
npx expo start
```

Then scan QR code from iPhone/Android Expo Go.

## First build includes

- Agent Code + Username + Password login UI
- Agent manager resolver support
- Clean non-crowded dashboard preview
- iOS/Android adaptive styling base
- Bottom app menu shell

## Manager URL

Default resolver:

`https://crm.travbizz.com/growin_manager/growin_resolve_agent.php`

## Login flow

Agent Code -> Manager Resolver -> Client CRM `growin_app/growin_api.php?endpoint=auth.login`

