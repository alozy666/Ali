<?php

declare(strict_types=1);

namespace App\Queue;

interface JobHandler
{
    /** نوع المهمة الذي يعالجه هذا الصنف */
    public function type(): string;

    /** يرمي استثناءً عند الفشل — الطابور يتكفّل بإعادة المحاولة */
    public function handle(Job $job): void;
}
