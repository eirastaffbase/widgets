# SB Custom / Celebration Widget

## Installation

```bash
$ npm install
```

## Running the app

| Command | Description |
|---|---|
| `npm start` | Starts the development server |
| `npm run build` | Creates the production build |
| `npm run build:watch` | Creates the production build and watch for changes |
| `npm run test` | Runs the unit tests |
| `npm run test:watch` | Runs the unit tests and watches for changes |
| `npm run type-check` | Checks the codebase on type errors |
| `npm run type-check:watch` | Checks the codebase on type errors and watches for changes |
| `npm run lint` | Checks the codebase on style issues |
| `npm run lint:fix` | Fixes style issues in the codebase |


## Building the form for configuration

This project uses [react-jsonschema-form](https://rjsf-team.github.io/react-jsonschema-form/) for configuring the widget properties. For more information consult their [documentation](https://react-jsonschema-form.readthedocs.io/en/latest/) 

The Celebration Widget will display users with a certain celebration date based on the settings. This can be used to display Birthdays, Work Anniversaries or a New Hire List.

The celebration dates for each user need to exist in a Custom Profile Field. 

The settings in the Experience Studio that the Admin sets will allow them to differentiate between the different types of celebrations (explained below).

Birthday Configuration:
[Birthday Configuration 2.0.pdf](https://github.com/Staffbase/cc-scripts/files/8222538/Birthday.Configuration.2.0.pdf)

Anniversary Configuration:
[Anniversary Configuration 2.0.pdf](https://github.com/Staffbase/cc-scripts/files/8222540/Anniversary.Configuration.2.0.pdf)

New Hire Configuration:
[New Hires Configuration 2.0.pdf](https://github.com/Staffbase/cc-scripts/files/8222543/New.Hires.Configuration.2.0.pdf)


