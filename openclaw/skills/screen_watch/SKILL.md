# screen_watch

Captures device activity evidence and classifies it as productive, neutral, or distracting.

## Inputs
- Screenshot or active app/window metadata
- Timestamp
- Device ID

## Outputs
- Activity classification
- Detected app
- Warden alert flag

## Triggers
- HEARTBEAT every 5 minutes
- Desktop or Android activity event
