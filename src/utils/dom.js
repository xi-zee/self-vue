/**
 * * 为什么不全部使用 setAttribute 可看 vue 设计与分析 8.2 小节 => HTML Attribute 与 DOM Properties 的关系
 * ! HTML Attributes 的作用是设置与之对应的 DOM Properties 的初始值
 * @description 为元素设置属性
 * @param {HTMLElement} el 元素
 * @param {String} key 属性名
 * @param {String} prevValue 属性值
 * @param {String} nextValue 属性值
 *
 * @example
 * * 假设我们使用 el[key] = value 或 el.setAttribute(key, value) 来设置属性
 * * <button disabled></button> 通过 vnode 描述为 { type: 'button', props: { disabled: '' } }
 * * 通过 el.disabled = '' 或 el.setAttribute('disabled', '') 设置 disabled 的值, 会被浏览器转化为对应的需要属性 boolean 即为 false, 这违反了用户的本意
 * * <button disabled="false"></button> 因为使用 setAttribute 函数设置的值总是会被字符串化 即变成了 el.setAttribute('disabled', 'false') 'false' 转 boolean 为 true, 与预期不符
 * * 但是我们设置 el.disabled = false 则符合预期
 * * 所以我们的 selfSetAttribute 函数就是为了解决这个问题
 */

export const selfSetAttribute = (el, key, prevValue, nextValue) => {
    if (/^on/.test(key)) {
        // 根据属性名称得到对应的事件名称，例如 onClick ---> click
        const invokers = el._vei || (el._vei = {});
        const name = key.slice(2).toLowerCase();
        let invoker = invokers[key];
        if (nextValue) {
            if (!invoker) {
                // 如果 invoker 不存在，则创建一个新的函数作为 invoker
                invoker = el._vei[key] = e => {
                    //! 如果事件发生的时间早于事件处理函数绑定的时间，则不执行事件处理函数
                    //! 不然就会出现下面情况: 事件是在响应式数据更新后才绑定的，但是也会导致由于事件冒泡慢于副作用函数执行（事件被绑定）导致的事件触发
                    if (e.timeStamp < invoker.attached) return;
                    // 如果 invoker.value 是数组，则遍历它并逐个调用事件处理函数
                    if (Array.isArray(invoker.value)) {
                        invoker.value.forEach(fn => fn(e));
                    } else {
                        invoker.value(e);
                    }
                };
                invoker.value = nextValue;
                invoker.attached = performance.now();
                el.addEventListener(name, invoker);
            } else {
                invoker.value = nextValue;
            }
        } else if (invoker) {
            // 新的事件不存在, 并且 invoker 存在, 则移除事件监听
            el.removeEventListener(name, invoker);
        }
    } else if (key === "class") {
        // * 通过 1000 次的 class 比对, 发现 setAttribute 性能较差, el.className 直接赋值性能较好, 故针对 class 单独处理
        el.className = nextValue;
    } else if (shouldSetAsProps(el, key, nextValue)) {
        const type = typeof el[key];
        if (type === "boolean" && nextValue === "") {
            // 针对 空字符 会被浏览器 转化为 false 的问题
            el[key] = true;
        } else {
            el[key] = nextValue;
        }
    } else {
        // 如果 key 不是元素的属性，则使用 setAttribute 函数设置属性
        el.setAttribute(key, nextValue);
    }
};

/**
 * @description 判断 properties 是否可以设置
 * @param {HTMLElement} el 元素
 * @param {String} key 属性名
 * @param {String} value 属性值
 * @returns {Boolean} 是否可以设置
 */
export const shouldSetAsProps = (el, key, value) => {
    if (key === "form" && el.tagName === "INPUT") return false;
    return key in el;
};
