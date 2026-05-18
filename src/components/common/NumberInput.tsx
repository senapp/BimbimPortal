import * as React from 'react';
import { useEffect, useState } from 'react';
import css from './NumberInput.module.css';

type Props = {
    label?: string;
    containerClassName?: string;
    value?: number;
    min?: number;
    max?: number;
    step?: number;
    onChange?: (value: number) => void;
}

export const NumberInput: React.FC<Props> = ({ label, containerClassName = '', min, max, value, step = 1, onChange  }) => {
    const [currentInput, setCurrentInput] = useState<string>(value?.toString() ?? '');

    useEffect(() => {
        if (value !== undefined) {
            setCurrentInput(value.toString());
        }
    }, [value]);

    const onValueChange = (newValue: string): void => {
        if (newValue.endsWith('.') || newValue.endsWith(',') || newValue === '') {
            setCurrentInput(newValue.replace(',', '.'));
            return;
        }

        let limitedValue = parseFloat(newValue);
        if (limitedValue.toString() === 'NaN') {
            return;
        } else if (step % 1 === 0) {
            limitedValue = Math.round(limitedValue);
            setCurrentInput(limitedValue.toString());
        }

        if (min && limitedValue < min) {
            limitedValue = min;
        } else if (max && max < limitedValue) {
            limitedValue = max;
        }

        if (onChange) {
            onChange(limitedValue);
        }

        if (value === undefined) {
            setCurrentInput(limitedValue.toString());
        }
    };

    return (
        <div className={`${css.container} ${containerClassName}`.trimEnd()}>
            <input className={css.input} value={currentInput} min={min} max={max} step={step} type="number" onChange={(e) => onValueChange(e.target.value)} />
            { label && <div className={css.label}>
                {label}
            </div> }
        </div>
    );
};