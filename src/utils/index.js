/**
 * @description 判断一个对象的属性是否不是 null 或 undefined
 */
export const hasOwn = (obj, key) => {
    return Object.hasOwn(obj, key);
};

/**
 * @description 属性是否不为 null 或 undefined
 */
export const notEmpty = something => {
    return something !== null && something !== void 0;
};

/**
 * @description 最长递增子序列，返回最长递增子序列的位置索引
 * @param {Array} originalArray 原始数组
 * @returns {Array} 最长递增子序列的位置索引
 */
export function getSequence(arr) {
    const p = arr.slice();
    const result = [0];
    let i, j, u, v, c;
    const len = arr.length;
    for (i = 0; i < len; i++) {
        const arrI = arr[i];
        if (arrI !== 0) {
            j = result[result.length - 1];
            if (arr[j] < arrI) {
                p[i] = j;
                result.push(i);
                continue;
            }
            u = 0;
            v = result.length - 1;
            while (u < v) {
                c = (u + v) >> 1;
                if (arr[result[c]] < arrI) {
                    u = c + 1;
                } else {
                    v = c;
                }
            }
            if (arrI < arr[result[u]]) {
                if (u > 0) {
                    p[i] = result[u - 1];
                }
                result[u] = i;
            }
        }
    }
    u = result.length;
    v = result[u - 1];
    while (u-- > 0) {
        result[u] = v;
        v = p[v];
    }
    return result;
}



/**
 * @description 使用 random 生成随机数，汲取符合 16 进制的颜色值
 * @returns {String} 颜色值
 */

export function randomColor() {
    return '#' + Math.floor(Math.random() * 0xffffff).toString(16).padEnd(6, '0');
}