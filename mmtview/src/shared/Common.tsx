import { StepStatus } from './types';

export const statusIconFor = (status: StepStatus) => {
    if (status === 'running') {
        return { icon: 'codicon-play-circle', color: '#0ABAB5', title: 'Running' };
    }
    if (status === 'cancelled') {
        return { icon: 'codicon-stop-circle', color: ' #7c4545', title: 'Cancelled' };
    }
    if (status === 'passed') {
        return { icon: 'codicon-pass', color: '#23d18b', title: 'Passed' };
    }
    if (status === 'failed') {
        return { icon: 'codicon-error', color: '#f85149', title: 'Failed' };
    }
    if (status === 'invalid') {
        return { icon: 'codicon-warning', color: '#f8b449', title: 'Error' };
    }
    if (status === 'pending') {
        return { icon: 'codicon-compass', color: '#7c847e', title: 'Pending' };
    }
    if (status === 'debug') {
        return { icon: 'codicon-debug', color: '#8973ea', title: 'Debug' };
    }
    return { icon: 'codicon-circle-large', color: '#c5c5c5', title: 'Default' };
};

export const aggregateStatuses = (statuses: Array<StepStatus | undefined | null>): StepStatus => {
    let anyFailed = false;
    let anyInvalid = false;
    let anyCancelled = false;
    let anyRunning = false;
    let anyPending = false;
    let anySeen = false;
    let allPassed = statuses.length > 0;

    for (const s of statuses) {
        if (!s) {
            allPassed = false;
            continue;
        }
        anySeen = true;
        if (s === 'running') {
            anyRunning = true;
        } else if (s === 'failed') {
            anyFailed = true;
        } else if (s === 'invalid') {
            anyInvalid = true;
        } else if (s === 'cancelled') {
            anyCancelled = true;
        } else if (s === 'pending') {
            anyPending = true;
        }
        if (s !== 'passed') {
            allPassed = false;
        }
    }

    if (anyRunning) {
        return 'running';
    }
    if (anyCancelled) {
        return 'cancelled';
    }
    if (anyFailed) {
        return 'failed';
    }
    if (anyInvalid) {
        return 'invalid';
    }
    if (anyPending) {
        return 'pending';
    }
    if (allPassed && anySeen) {
        return 'passed';
    }
    return 'default';
};
