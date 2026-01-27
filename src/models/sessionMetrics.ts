/**
 * 会话指标接口
 * 从data.csv文件定义的指标接口
 */

/**
 * 指标项接口
 */
export interface MetricItem {
    category: string;           // 分类
    name: string;              // 指标名称
    fieldName: string;        // JSON路径字段名
    example: string;           // 数据示范
    value: string;             // 计算后的值
}

/**
 * 会话指标提取器
 * 从composerData中提取定义的指标
 */
export class SessionMetricsExtractor {
    /**
     * CSV文件中定义的标准指标列表
     */
    private static readonly STANDARD_METRICS: MetricItem[] = [
        {
            category: '基础信息',
            name: '功能名称',
            fieldName: 'name',
            example: '插件登录独立页面',
            value: ''
        },
        {
            category: '基础信息',
            name: 'Git 分支',
            fieldName: 'createdOnBranch',
            example: '004-popup-login-auth',
            value: ''
        },
        {
            category: '代码量化',
            name: '新增行数',
            fieldName: 'totalLinesAdded',
            example: '1871',
            value: ''
        },
        {
            category: '代码量化',
            name: '删除行数',
            fieldName: 'totalLinesRemoved',
            example: '898',
            value: ''
        },
        {
            category: '代码量化',
            name: '变更文件总数',
            fieldName: 'filesChangedCount',
            example: '26',
            value: ''
        },
        {
            category: '效能度量',
            name: '开发总耗时',
            fieldName: 'duration',
            example: '9,014,943 ms (约 2.5h)',
            value: ''
        },
        {
            category: '效能度量',
            name: '任务完成率',
            fieldName: 'todosStatus',
            example: '8/8 (100% Completed)',
            value: ''
        },
        {
            category: '上下文用量',
            name: '上下文负载',
            fieldName: 'contextTokensUsed',
            example: '103928',
            value: ''
        },
        {
            category: '上下文用量',
            name: '上下文限制',
            fieldName: 'contextTokenLimit',
            example: '200000',
            value: ''
        },
        {
            category: '上下文用量',
            name: '上下文使用占比',
            fieldName: 'contextUsagePercent',
            example: '52%',
            value: ''
        },
        {
            category: '协作模型',
            name: '核心模型',
            fieldName: 'modelConfig.modelName',
            example: 'claude-4.5-sonnet',
            value: ''
        },
        {
            category: '协作模型',
            name: '是否MAX模式',
            fieldName: 'modelConfig.maxMode',
            example: 'FALSE',
            value: ''
        },
        {
            category: '协作模型',
            name: '运行模式',
            fieldName: 'unifiedMode',
            example: 'agent',
            value: ''
        }
    ];

    /**
     * 从composerData中提取指标值
     * @param composerData composer数据对象
     * @param metrics 指标列表（默认使用标准指标）
     * @returns 带值的指标列表（过滤掉不存在的指标）
     */
    public static extractMetrics(composerData: any, metrics: MetricItem[] = this.STANDARD_METRICS): MetricItem[] {
        if (!composerData) {
            return [];
        }

        // 使用中间类型来处理可能是 undefined 的 value
        type MetricWithOptionalValue = Omit<MetricItem, 'value'> & { value?: string };

        const extractedMetrics: MetricWithOptionalValue[] = metrics.map(metric => {
            try {
                const value = this.extractValueByPath(composerData, metric.fieldName);
                return {
                    ...metric,
                    value: value !== undefined && value !== null ? String(value) : undefined
                };
            } catch (error) {
                return {
                    ...metric,
                    value: undefined
                };
            }
        });

        // 过滤掉值未定义的指标，并确保类型正确
        return extractedMetrics
            .filter((metric): metric is MetricItem => metric.value !== undefined)
            .map(metric => ({ ...metric, value: metric.value! })); // 非空断言，因为我们已经过滤了 undefined
    }

    /**
     * 根据JSON路径提取值
     * @param data 数据对象
     * @param path JSON路径（支持点号分隔的嵌套路径）
     * @returns 提取的值
     */
    private static extractValueByPath(data: any, path: string): any {
        if (!data || typeof data !== 'object') {
            return undefined;
        }

        // 处理特殊路径
        if (path === 'duration') {
            const value = this.calculateDuration(data);
            // 如果计算结果为 N/A 或 0ms，说明源数据不存在，返回 undefined
            if (value === 'N/A' || value === '0s (0 ms)') {
                return undefined;
            }
            return value;
        }

        if (path === 'todosStatus') {
            const value = this.calculateTodosStatus(data);
            // 如果计算结果为 N/A，说明源数据不存在，返回 undefined
            if (value === 'N/A') {
                return undefined;
            }
            return value;
        }

        if (path === 'contextUsagePercent') {
            const value = this.calculateContextUsagePercent(data);
            // 如果计算结果为 N/A 或 0%，说明源数据不存在，返回 undefined
            if (value === 'N/A' || value === '0%') {
                return undefined;
            }
            return value;
        }

        // 处理普通路径
        const pathParts = path.split('.');
        let current: any = data;

        for (const part of pathParts) {
            if (current === null || current === undefined || typeof current !== 'object') {
                return undefined;
            }
            current = current[part];
        }

        return current;
    }

    /**
     * 计算开发总耗时
     * @param composerData composer数据
     * @returns 格式化的耗时字符串
     */
    private static calculateDuration(composerData: any): string {
        try {
            const createdAt = composerData.createdAt;
            const lastUpdatedAt = composerData.lastUpdatedAt;
            
            if (!createdAt || !lastUpdatedAt) {
                return 'N/A';
            }

            const durationMs = lastUpdatedAt - createdAt;
            const durationSeconds = Math.floor(durationMs / 1000);
            const durationMinutes = Math.floor(durationSeconds / 60);
            const durationHours = Math.floor(durationMinutes / 60);
            
            if (durationHours > 0) {
                const remainingMinutes = durationMinutes % 60;
                return `${durationHours}h ${remainingMinutes}m (${durationMs.toLocaleString()} ms)`;
            } else if (durationMinutes > 0) {
                const remainingSeconds = durationSeconds % 60;
                return `${durationMinutes}m ${remainingSeconds}s (${durationMs.toLocaleString()} ms)`;
            } else {
                return `${durationSeconds}s (${durationMs.toLocaleString()} ms)`;
            }
        } catch (error) {
            return 'N/A';
        }
    }

    /**
     * 计算任务完成率
     * @param composerData composer数据
     * @returns 格式化的完成率字符串
     */
    private static calculateTodosStatus(composerData: any): string {
        try {
            // 尝试从多个可能的路径获取todos数据
            const todosPaths = [
                'todos',
                'metadata.todos',
                'data.todos',
                'context.todos'
            ];

            let todos: any[] = [];
            
            for (const path of todosPaths) {
                const todosData = this.extractValueByPath(composerData, path);
                if (Array.isArray(todosData)) {
                    todos = todosData;
                    break;
                }
            }

            if (todos.length === 0) {
                return 'N/A';
            }

            const completedTodos = todos.filter(todo => 
                todo.status === 'completed' || todo.status === 'done' || todo.completed
            ).length;

            const totalTodos = todos.length;
            const completionRate = totalTodos > 0 ? Math.round((completedTodos / totalTodos) * 100) : 0;

            return `${completedTodos}/${totalTodos} (${completionRate}% Completed)`;
        } catch (error) {
            return 'N/A';
        }
    }

    /**
     * 计算上下文使用占比
     * @param composerData composer数据
     * @returns 格式化的使用占比字符串
     */
    private static calculateContextUsagePercent(composerData: any): string {
        try {
            const contextTokensUsed = composerData.contextTokensUsed || 0;
            const contextTokenLimit = composerData.contextTokenLimit || 1;
            
            if (contextTokenLimit <= 0) {
                return 'N/A';
            }

            const usagePercent = Math.round((contextTokensUsed / contextTokenLimit) * 100);
            return `${usagePercent}%`;
        } catch (error) {
            return 'N/A';
        }
    }

    /**
     * 生成 Markdown 表格
     * @param metrics 指标列表
     * @returns Markdown 表格字符串
     */
    public static generateMetricsTable(metrics: MetricItem[]): string {
        if (!metrics || metrics.length === 0) {
            return '*该会话暂无可用的指标数据*';
        }

        const fragments: string[] = [];
        
        // 生成单个包含分类的表格
        const headers = ['分类', '指标', '数值'];
        const rows: string[][] = [];
        
        for (const metric of metrics) {
            // 分类
            const category = metric.category;
            // 指标名称
            const metricName = metric.name;
            // 数值（现在不会为空，因为已经过滤过）
            const metricValue = metric.value.trim();
            
            rows.push([category, metricName, metricValue]);
        }
        
        // 生成Markdown表格
        fragments.push(this.generateMarkdownTable(headers, rows));
        
        return fragments.join('\n');
    }

    /**
     * 生成Markdown表格的辅助方法
     * @param headers 表头
     * @param rows 数据行
     * @returns Markdown表格字符串
     */
    private static generateMarkdownTable(headers: string[], rows: string[][]): string {
        if (headers.length === 0) {
            return '';
        }

        const fragments: string[] = [];
        
        // 表头
        fragments.push('| ' + headers.join(' | ') + ' |');
        
        // 分隔线
        fragments.push('| ' + headers.map(() => '---').join(' | ') + ' |');
        
        // 数据行
        for (const row of rows) {
            // 确保行数据长度与表头一致
            const paddedRow = [...row];
            while (paddedRow.length < headers.length) {
                paddedRow.push('');
            }
            fragments.push('| ' + paddedRow.slice(0, headers.length).join(' | ') + ' |');
        }
        
        return fragments.join('\n');
    }

    /**
     * 获取标准指标列表
     * @returns 标准指标列表
     */
    public static getStandardMetrics(): MetricItem[] {
        return [...this.STANDARD_METRICS];
    }
}