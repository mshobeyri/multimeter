
import { StepStatus } from './types';

export const statusIconFor = (status: StepStatus) => {
    if (status === 'running') {
        return { icon: 'codicon-play-circle', color: '#BA8E23', title: 'Running' };
    }
    if (status === 'cancelled') {
        return { icon: 'codicon-stop-circle', color: ' #f88349', title: 'Cancelled' };
    }
    if (status === 'passed') {
        return { icon: 'codicon-pass', color: '#23d18b', title: 'Passed' };
    }
    if (status === 'failed') {
        return { icon: 'codicon-error', color: '#f85149', title: 'Failed' };
    }
    if (status === 'invalid') {
        return { icon: 'codicon-warning', color: '#f8b449', title: 'Invalid' };
    }
    if (status === 'pending') {
        return { icon: 'codicon-compass', color: '#3794ff', title: 'Pending' };
    }
    if (status === 'debug') {
        return { icon: 'codicon-debug', color: '#c5c5c5', title: 'Debug' };
    }
    return { icon: 'codicon-circle-large', color: '#c5c5c5', title: 'Default' };
};

export type SuiteGroupAggregationMode = 'run';

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

export type LeafVisibilityInputs = {
    leafState?: StepStatus;
    explicitRunStatus?: StepStatus;
    isPending?: boolean;
};

export const leafVisibleStatus = (inputs: LeafVisibilityInputs): StepStatus | undefined => {
    const { leafState, explicitRunStatus, isPending } = inputs;
    if (leafState) {
        return leafState;
    }
    if (explicitRunStatus && explicitRunStatus !== 'pending') {
        return explicitRunStatus;
    }
    if (isPending) {
        return 'pending';
    }
    return undefined;
};

export const aggregateLeafIds = (opts: {
    leafIds: string[];
    getVisible: (leafId: string) => StepStatus | undefined;
}): StepStatus => {
    const statuses = opts.leafIds.map((id) => opts.getVisible(id));
    return aggregateStatuses(statuses);
};
