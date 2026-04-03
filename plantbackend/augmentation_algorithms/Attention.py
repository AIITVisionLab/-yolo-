import torch
from torch import nn

# 通道注意力机制
class ChannelAttention(nn.Module):
    def __init__(self, channels, reduction=16):
        super(ChannelAttention, self).__init__()
        # 自适应平均池化，将输入特征图压缩为 1x1 的空间尺寸
        self.avg_pool = nn.AdaptiveAvgPool2d(1)
        # 自适应最大池化，将输入特征图压缩为 1x1 的空间尺寸
        self.max_pool = nn.AdaptiveMaxPool2d(1)

        # 通道注意力的全连接层：通过压缩和恢复特征维度来学习通道注意力
        self.fn = nn.Sequential(
            nn.Linear(channels, channels // reduction),  # 压缩维度
            nn.ReLU(inplace=True),  # 激活函数
            nn.Linear(channels // reduction, channels, bias=False),  # 恢复维度
        )
        # Sigmoid 激活函数，用来输出在 [0, 1] 范围内的注意力权重
        self.sigmoid = nn.Sigmoid()

    def forward(self, x):
        b, c, _, _ = x.size()  # 获取输入特征图的 batch_size 和通道数
        # 对输入特征图进行平均池化和最大池化
        avg_out = self.fn(self.avg_pool(x).view(b, c))  # 使用平均池化处理特征图
        max_out = self.fn(self.max_pool(x).view(b, c))  # 使用最大池化处理特征图

        # 将两种池化结果相加，然后通过 sigmoid 函数输出通道注意力权重
        weight = self.sigmoid(avg_out + max_out).view(b, c, 1, 1)

        # 将注意力权重应用到原始输入特征图
        return weight * x

# 空间注意力机制
class SpatialAttention(nn.Module):
    def __init__(self, kernel_size=7):
        super(SpatialAttention, self).__init__()
        # 卷积层：用于计算空间注意力权重
        padding = kernel_size // 2  # 为了保持输出特征图尺寸不变
        self.conv = nn.Conv2d(1, 2, kernel_size, stride=1, padding=padding)
        # Sigmoid 激活函数，用于生成空间注意力图
        self.sigmoid = nn.Sigmoid()

    def forward(self, x):
        # 计算平均值和最大值（分别沿通道维度）
        avg_out = torch.mean(x, dim=1, keepdim=True)  # 沿通道维度进行平均池化
        max_out, _ = torch.max(x, dim=1, keepdim=True)  # 沿通道维度进行最大池化
        # 将平均池化和最大池化的结果拼接起来
        torchcat = torch.cat([avg_out, max_out], dim=1)

        # 使用卷积层计算空间注意力图
        weight = self.sigmoid(self.conv(torchcat))

        # 将空间注意力权重应用到输入特征图
        return weight * x

# 通道-空间注意力模块（CBAM）
class CBAM(nn.Module):
    def __init__(self, channels, reduction=16, kernel_size=7):
        super(CBAM, self).__init__()
        # 初始化通道注意力模块
        self.channel_attention = ChannelAttention(channels, reduction)
        # 初始化空间注意力模块
        self.spatial_attention = SpatialAttention(kernel_size)

    def forward(self, x):
        # 先应用通道注意力机制
        x = self.channel_attention(x)
        # 然后应用空间注意力机制
        x = self.spatial_attention(x)
        return x

# 坐标注意力机制
class CoordAttention(nn.Module):
    def __init__(self, in_channels, kernel_size=3):
        super(CoordAttention, self).__init__()
        self.in_channels = in_channels
        self.kernel_size = kernel_size

        # 在x方向和y方向分别使用卷积操作，捕捉空间坐标的注意力
        # 使用深度可分离卷积（groups=in_channels）来保持通道独立性
        self.conv_x = nn.Conv2d(in_channels, in_channels, kernel_size=kernel_size, padding=kernel_size//2, groups=in_channels)
        self.conv_y = nn.Conv2d(in_channels, in_channels, kernel_size=kernel_size, padding=kernel_size//2, groups=in_channels)

    def forward(self, x):
        # 计算 x 方向的坐标注意力，沿高度维度求平均
        x_coord = torch.mean(x, dim=2, keepdim=True)  # 对 x 方向（高度）进行平均池化
        x_coord = self.conv_x(x_coord)  # 使用卷积生成注意力图

        # 计算 y 方向的坐标注意力，沿宽度维度求平均
        Y_coord = torch.mean(x, dim=3, keepdim=True)  # 对 y 方向（宽度）进行平均池化
        Y_coord = self.conv_y(Y_coord)  # 使用卷积生成注意力图

        # 合并 x 和 y 方向的注意力图，并通过 sigmoid 激活函数生成最终的注意力权重
        weight = torch.sigmoid(x_coord + Y_coord)

        # 将坐标注意力权重应用到输入特征图
        return weight * x
