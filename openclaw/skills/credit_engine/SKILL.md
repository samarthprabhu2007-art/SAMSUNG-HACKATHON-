# credit_engine

Manages Energy Points (EP), including awards, deductions, and idle decay.

## Inputs
- `userId`
- `activity`
- `durationMinutes`
- `reason`

## Outputs
- Updated EP balance
- EP history entry in memory

## Triggers
- Called after quiz verification
- Called after activity classification
- Called during app access countdowns
