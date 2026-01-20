/**
 * 用户资料模型
 */

/**
 * 用户资料接口
 * 用于缓存当前登录用户的个人信息
 */
export interface UserProfile {
    /**
     * 用户邮箱地址(唯一标识符)
     */
    email: string;

    /**
     * 昵称/用户名
     */
    nickname: string;

    /**
     * 用户头像URL（可能是Base64或HTTP URL）
     * 来源于后端 Profile API
     */
    avatarUrl?: string;

    /**
     * 部门
     */
    department?: string;

    /**
     * 工号
     */
    employeeId?: string;

    /**
     * 用户角色 (user | admin)
     */
    role?: string;

    /**
     * 最后同步时间戳(毫秒)
     * 用于判断缓存是否过期
     */
    lastSyncedAt: number;
}

/**
 * 头像缓存条目
 * 用于在本地文件系统缓存已下载的用户头像
 */
export interface AvatarCacheEntry {
    /**
     * 用户邮箱(作为缓存key)
     */
    email: string;

    /**
     * 本地文件路径
     */
    localPath: string;

    /**
     * 最后获取时间戳(毫秒)
     * 用于判断缓存是否过期(默认30天)
     */
    lastFetched: number;
}
