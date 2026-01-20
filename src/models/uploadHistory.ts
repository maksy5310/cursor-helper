/**
 * 上传历史数据模型
 */

/**
 * 上传状态枚举
 */
export enum UploadStatus {
    SUCCESS = 'success',
    FAILED = 'failed',
    PENDING = 'pending'
}

/**
 * 上传历史记录接口
 */
export interface UploadHistoryEntry {
    record_id?: string;        // 记录ID（上传成功时）
    upload_time: string;       // 上传时间（ISO 8601格式）
    status: UploadStatus;      // 上传状态
    error_message?: string;    // 错误消息（失败时）
    project_name?: string;     // 项目名称
    file_path?: string;        // 文件路径
}

