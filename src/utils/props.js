/**
 * @description 处理 props 的函数
 * @param {object} propsOptions props 的选项
 * @param {object} propsValue props 的值
 *
 * @returns {Array} 返回一个数组, 第一个元素是 props, 第二个元素是 attrs
 */
export const resolveProps = (propsOptions, propsValue) => {
    const props = {};
    const attrs = {};

    // 还可处理默认直、类型校验
    for (const key in propsValue) {
        if (key in propsOptions || key.startsWith('on')) {
            const propValue = propsOptions[key];
            const defaultValue =  typeof propValue === 'object' ? propsOptions[key].default : void 0;
            props[key] =
                propsValue[key] ?? (typeof defaultValue === "function"
                    ? defaultValue()
                    : defaultValue);
        }
        else {
            // 如果 propsOptions 中没有这个属性，则认为是一个普通属性
            attrs[key] = propsValue[key];
        }
    }

    return [props, attrs];
};

/**
 * 
 * @param {object} prevProps 
 * @param {object} nextProps 
 * @returns {boolean}
 */
export const hasPropsChanged = (prevProps = {}, nextProps = {}) => {
    const nextKeys = Object.keys(nextProps);
    const prevKeys = Object.keys(prevProps);

    if (nextKeys.length !== prevKeys.length) {
        return true;
    }
    for (const key of nextKeys) {
        if (prevProps[key] !== nextProps[key]) return true;
    }
    return false;
};
