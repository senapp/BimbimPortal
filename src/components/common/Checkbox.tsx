import * as React from 'react';
import { useEffect, useState } from 'react';
import css from './Checkbox.module.css';

type Props = {
    label?: string;
    value?: boolean;
    defaultValue?: boolean;
    onChange: (checked: boolean) => void;
}

export const Checkbox: React.FC<Props> = ({ label, value, onChange }) => {
    const [checked, setChecked] = useState(value ?? false);

    useEffect(() => {
        if (value !== undefined) {
            setChecked(value);
        }
    }, [value]);

    const onValueChanged = (): void => {
        onChange(!checked);
        if (value === undefined) {
            setChecked(!checked);
        }
    };

    return (
        <div className={css.container}>
            <input className={css.input} type="checkbox" checked={checked} onChange={onValueChanged} />
            { label && <div className={css.label}>
                {label}
            </div> }
        </div>
    );
};