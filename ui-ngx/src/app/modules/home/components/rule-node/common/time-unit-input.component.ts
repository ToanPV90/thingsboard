///
/// Copyright © 2016-2024 The Thingsboard Authors
///
/// Licensed under the Apache License, Version 2.0 (the "License");
/// you may not use this file except in compliance with the License.
/// You may obtain a copy of the License at
///
///     http://www.apache.org/licenses/LICENSE-2.0
///
/// Unless required by applicable law or agreed to in writing, software
/// distributed under the License is distributed on an "AS IS" BASIS,
/// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
/// See the License for the specific language governing permissions and
/// limitations under the License.
///

import { Component, DestroyRef, forwardRef, Input, OnInit } from '@angular/core';
import {
  AbstractControl,
  ControlValueAccessor,
  FormBuilder,
  NG_VALIDATORS,
  NG_VALUE_ACCESSOR,
  ValidationErrors,
  Validator, Validators
} from '@angular/forms';
import { TimeUnit, timeUnitTranslations } from '../rule-node-config.models';
import { isDefinedAndNotNull, isNumeric } from '@core/utils';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { coerceBoolean, coerceNumber } from '@shared/decorators/coercion';
import { DAY, HOUR, MINUTE, SECOND } from '@shared/models/time/time.models';

interface TimeUnitInputModel {
  time: number;
  timeUnit: TimeUnit
}

@Component({
  selector: 'tb-time-unit-input',
  templateUrl: './time-unit-input.component.html',
  providers: [{
    provide: NG_VALUE_ACCESSOR,
    useExisting: forwardRef(() => TimeUnitInputComponent),
    multi: true
  },{
    provide: NG_VALIDATORS,
    useExisting: forwardRef(() => TimeUnitInputComponent),
    multi: true
  }]
})
export class TimeUnitInputComponent implements ControlValueAccessor, Validator, OnInit {

  @Input()
  labelText: string;

  @Input()
  @coerceBoolean()
  required: boolean;

  @Input()
  requiredText: string;

  @Input()
  minErrorText: string;

  @Input()
  @coerceNumber()
  maxTime: number;

  @Input()
  maxErrorText: string;

  timeUnits = Object.values(TimeUnit).filter(item => item !== TimeUnit.MILLISECONDS) as TimeUnit[];

  timeUnitTranslations = timeUnitTranslations;

  timeInputForm = this.fb.group({
    time: [0, Validators.min(0)],
    timeUnit: [TimeUnit.SECONDS]
  });

  private timeIntervalsInSec = new Map<TimeUnit, number>([
    [TimeUnit.DAYS, DAY/SECOND],
    [TimeUnit.HOURS, HOUR/SECOND],
    [TimeUnit.MINUTES, MINUTE/SECOND],
    [TimeUnit.SECONDS, SECOND/SECOND],
  ]);

  private modelValue: number;

  private propagateChange: (value: any) => void = () => {};

  constructor(private fb: FormBuilder,
              private destroyRef: DestroyRef) {
  }

  ngOnInit() {
    if(this.required || this.maxTime) {
      const timeControl = this.timeInputForm.get('time');
      const validators = [];
      if (this.required) {
        validators.push(Validators.required);
      }
      if (this.maxTime) {
        validators.push((control: AbstractControl) =>
          Validators.max(Math.floor(this.maxTime / this.timeIntervalsInSec.get(this.timeInputForm.get('timeUnit').value)))(control)
        );
      }

      timeControl.setValidators(validators);
      timeControl.updateValueAndValidity({ emitEvent: false });
    }

    this.timeInputForm.get('timeUnit').valueChanges.pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(() => {
      this.timeInputForm.get('time').updateValueAndValidity({onlySelf: true});
      this.timeInputForm.get('time').markAsTouched({onlySelf: true});
    });

    this.timeInputForm.valueChanges.pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(value => {
      this.updatedModel(value);
    });
  }

  registerOnChange(fn: any) {
    this.propagateChange = fn;
  }

  registerOnTouched(_fn: any) {
  }

  setDisabledState(isDisabled: boolean) {
    if (isDisabled) {
      this.timeInputForm.disable({emitEvent: false});
    } else {
      this.timeInputForm.enable({emitEvent: false});
    }
  }

  writeValue(sec: number) {
    if (sec !== this.modelValue) {
      if (isDefinedAndNotNull(sec) && isNumeric(sec) && Number(sec) !== 0) {
        this.timeInputForm.patchValue(this.parseTime(sec), {emitEvent: false});
        this.modelValue = sec;
      } else {
        this.timeInputForm.patchValue({
          time: 0,
          timeUnit: TimeUnit.SECONDS
        }, {emitEvent: false});
        this.modelValue = 0;
      }
    }
  }

  validate(): ValidationErrors | null {
    return this.timeInputForm.valid ? null : {
      timeInput: false
    };
  }

  private updatedModel(value: Partial<TimeUnitInputModel>) {
    const time = value.time * this.timeIntervalsInSec.get(value.timeUnit);
    if (this.modelValue !== time) {
      this.modelValue = time;
      this.propagateChange(time);
    }
  }

  private parseTime(value: number): TimeUnitInputModel {
    for (const [timeUnit, timeValue] of this.timeIntervalsInSec) {
      const calc = value / timeValue;
      if (Number.isInteger(calc)) {
        return {
          time: calc,
          timeUnit: timeUnit
        }
      }
    }
  }

}
