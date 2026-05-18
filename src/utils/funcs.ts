export const removeElementArray = <T>(arr: T[], ele: T): void => {
    for (let i = arr.length - 1; i >= 0; i--) {
        if (arr[i] == ele) {
            arr.splice(i, 1);
        }
    }
};